# First-Party Analytics — Setup From Scratch

Last updated: 2026-09-06 — v01
Source: the Keepprz web analytics playbook, de-named and made standalone.
Reference implementation live since 2026-08-15.

Traffic tracking you own: a few lines of JS post each pageview to a Netlify
function, which writes to your own Supabase table. No vendor, no expiry, no
bill, no cookie banner. Setup is about fifteen minutes on a Netlify + Supabase
site.

**Why not Google Analytics:** ad blockers stop third-party analytics endpoints
by design — that is the entire product category they exist to block. This
beacon posts to your own domain, so it is not blocked, and the data is in your
database rather than someone else's.

**Why not Netlify's built-in analytics:** it keeps only 30 days and has no
public API. Fine as a bonus, useless as a record.

---

## 1. Privacy, deliberately

No cookies. No IP stored. No full user agent. No cross-day identity.

The visitor hash is salted with the **current date**, so it counts repeat views
within one day and is meaningless tomorrow. Nothing here needs a cookie
banner, and that is a design constraint, not an accident. Keep it that way —
the moment you store something durable per person, you have acquired a legal
obligation you did not have before.

---

## 2. The database

Apply this to your Supabase project (SQL Editor, or as a migration).

```sql
create table if not exists public.web_sites (
  site_key    text primary key,
  name        text not null,
  domain      text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.web_admins (
  user_id    uuid primary key,
  name       text,
  created_at timestamptz not null default now()
);

create or replace function public.web_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.web_admins where user_id = auth.uid());
$$;

create table if not exists public.web_pageviews (
  id            bigserial primary key,
  site_key      text not null references public.web_sites(site_key) on update cascade,
  seen_at       timestamptz not null default now(),
  path          text not null,
  referrer_host text,
  country       text,
  device        text,
  visitor_hash  text
);
create index if not exists web_pageviews_site_seen_idx on public.web_pageviews (site_key, seen_at desc);
create index if not exists web_pageviews_site_path_idx on public.web_pageviews (site_key, path);

alter table public.web_sites     enable row level security;
alter table public.web_admins    enable row level security;
alter table public.web_pageviews enable row level security;

create policy "web admins read sites"     on public.web_sites     for select using (web_is_admin());
create policy "web admins read admins"    on public.web_admins    for select using (web_is_admin());
create policy "web admins read pageviews" on public.web_pageviews for select using (web_is_admin());

-- No insert/update policies anywhere. Only the Netlify function writes, using
-- the Supabase SECRET key, which bypasses RLS. This is what makes a leaked
-- publishable key unable to forge traffic.
```

Then register the site:

```sql
insert into web_sites (site_key, name, domain)
values ('acme', 'Acme Co', 'acmeco.com');
```

`site_key` is a short slug. It is keyed per site rather than per table so that
several sites can share these tables and you can still ask "which of my sites
got the most traffic this month."

Add yourself as an admin so you can read the data back — insert your own
`auth.users` UUID into `web_admins`.

---

## 3. Environment variables

Set these on the Netlify site (Site configuration → Environment variables):

| Variable | Value | Secret? |
|---|---|---|
| `SITE_KEY` | the slug you used above, e.g. `acme` | no |
| `SUPABASE_URL` | `https://<your-ref>.supabase.co` | no |
| `SUPABASE_SERVICE_KEY` | your Supabase **secret** key, `sb_secret_…` | **yes** |
| `ANALYTICS_SALT` | any random string | yes |

**Gotchas that have already cost time:**

- **Netlify warns that `SUPABASE_URL` "looks sensitive."** It is not — it is a
  hostname, already public in any client bundle. Click *Save without marking as
  secret*. Rule of thumb: **keys are secret, addresses are not.**
- **Marking a variable secret is one-way.** You can never read its value back.
  Leave non-secrets unmarked so they can be verified later.
- **The Netlify API can report success and change nothing.** Env vars set
  through the API have returned "upserted" and not persisted; they had to be
  entered in the UI. **Always read back what you set.**

---

## 4. The function

Save as `netlify/functions/hit.mjs`. Nothing in it is site-specific.

```js
import { createHash } from 'node:crypto';

const BOT = /bot|crawler|spider|crawl|slurp|headless|lighthouse|pingdom|uptime|curl|wget|python-requests|axios|monitoring|preview|facebookexternalhit|whatsapp|telegram|semrush|ahrefs|screaming/i;

/** New sb_secret_ keys authenticate on apikey alone; legacy service_role JWTs want both. */
function authHeaders(key) {
  if (key.startsWith('sb_')) return { apikey: key };
  return { apikey: key, Authorization: `Bearer ${key}` };
}

function deviceClass(ua = '') {
  if (/ipad|tablet|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobi|iphone|ipod|android.*mobile|windows phone/i.test(ua)) return 'mobile';
  return 'desktop';
}

/** Referring HOST only — never the full URL, which can carry search terms. */
function referrerHost(ref, selfHost) {
  if (!ref) return null;
  try {
    const h = new URL(ref).hostname.replace(/^www\./, '');
    return h === selfHost ? null : h;
  } catch { return null; }
}

function cleanPath(raw) {
  if (typeof raw !== 'string' || !raw.startsWith('/')) return null;
  const p = raw.split('?')[0].split('#')[0];
  return p.length > 300 ? p.slice(0, 300) : p;
}

export default async (req, context) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const siteKey = process.env.SITE_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!siteKey || !supabaseUrl || !serviceKey) {
    console.error('[hit] missing env — need SITE_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY');
    return new Response(null, { status: 204 }); // never let analytics break a page
  }

  const ua = req.headers.get('user-agent') || '';
  if (BOT.test(ua)) return new Response(null, { status: 204 });

  let body = {};
  try { body = await req.json(); } catch { return new Response(null, { status: 204 }); }

  const path = cleanPath(body.path);
  if (!path) return new Response(null, { status: 204 });

  const selfHost = (() => {
    try { return new URL(req.url).hostname.replace(/^www\./, ''); } catch { return ''; }
  })();

  const ip =
    req.headers.get('x-nf-client-connection-ip') ||
    (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    context?.ip || '';

  const day = new Date().toISOString().slice(0, 10);
  const salt = process.env.ANALYTICS_SALT || 'change-me';

  const row = {
    site_key: siteKey,
    path,
    referrer_host: referrerHost(body.referrer, selfHost),
    country: context?.geo?.country?.code || null,
    device: deviceClass(ua),
    visitor_hash: createHash('sha256').update(`${day}|${salt}|${ip}|${ua}`).digest('hex').slice(0, 32),
  };

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/web_pageviews`, {
      method: 'POST',
      headers: { ...authHeaders(serviceKey), 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(row),
    });
    if (!res.ok) console.error('[hit] insert failed', res.status, await res.text());
  } catch (err) {
    console.error('[hit] insert threw', err?.message);
  }

  return new Response(null, { status: 204 });
};
```

Note it returns **204 on every failure path**. Analytics must never be able to
break a page or show an error to a visitor.

Point Netlify at the functions folder in `netlify.toml` — create the file with
just this if the site does not have one:

```toml
[build]
  functions = "netlify/functions"
```

---

## 5. The beacon

Paste immediately before `</body>`. On a framework, once in the base layout.
On plain static HTML, on every page (or in the shared header/footer include).

```html
<script>
  (function () {
    try {
      if (navigator.webdriver) return;
      fetch('/.netlify/functions/hit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: location.pathname, referrer: document.referrer }),
        keepalive: true,
      }).catch(function () {});
    } catch (e) {}
  })();
</script>
```

It posts to `/.netlify/functions/hit` directly rather than through a prettier
`/api/hit` redirect. Netlify has ignored that redirect on one site while
honouring the identical pattern on another. Do not fight it — same-origin is
the part that matters.

---

## 6. Verify — every time, without exception

**Never trust a success message. Read the data back.**

```sql
select seen_at, path, referrer_host, device, country
from web_pageviews
where site_key = 'acme'
order by seen_at desc
limit 20;
```

Load the live site in a browser, then run that query. If rows do not appear:

1. Netlify → Functions → `hit` → check the logs for the `[hit] missing env`
   line. That is the usual answer.
2. Confirm the env vars actually persisted (§3 — read them back).
3. Confirm `site_key` matches a row in `web_sites` — the foreign key rejects
   the insert otherwise, and the failure is only visible in the function log.
