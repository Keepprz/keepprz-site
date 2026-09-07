# Supabase Conventions — Tables, RLS, and the Login Trap

Last updated: 2026-09-06 — v01
Source: the Keepprz website build workflow (v3), Phases 2, 3 and 7.

**Row-level security is the one thing on a Supabase site that fails silently
and expensively.** Nothing looks broken. The site works, the data saves, and
anyone with your publishable key — which ships in your HTML, visible to
everybody — can read every row in every table you forgot to protect. Read this
before launch, not after.

---

## 1. The key model, in one paragraph

Supabase renamed its keys: what used to be `anon` is the **publishable key**,
what used to be `service_role` is the **secret key** (`sb_secret_…`).

- **The publishable key is meant to be public.** It ships in your client code.
  It is not a password. It can do *exactly* what your RLS policies allow and
  nothing else. If your policies are right, publishing it is harmless.
- **The secret key bypasses RLS entirely.** It must never appear in client
  code, in a repo, or in anything a browser can fetch. It lives in a
  server-side environment variable and nowhere else.

That distinction is the whole security model. Everything below is detail.

**Gotcha:** new-style `sb_secret_…` keys must be sent on the `apikey` header
**only**. Adding `Authorization: Bearer` makes Supabase try to parse it as a
JWT and reject it. Legacy `service_role` JWTs want both headers. Detect the
`sb_` prefix and branch.

---

## 2. Table design

Prefix tables per site if several sites share one Supabase project
(`acme_orders`, `acme_customers`). Drop the prefix if the site has its own
project. Pick one and be consistent — a half-prefixed schema is worse than
either.

A typical shape:

- `xx_items` — the public catalog. Include an `is_published` boolean.
- `xx_orders` / `xx_signups` — one row per person. Unique on the natural key
  (e.g. `(item_id, email)`) so a double submit cannot make a duplicate.
- `xx_admins` — an allow-list of who can see admin screens.

## 3. RLS, in plain terms

The default posture for every table is **deny**, then open exactly what the
site needs:

- **Public read of published rows only** — `is_published = true`. Not the
  whole table.
- **Public insert on sign-ups/orders, but NO public read.** People need to be
  able to submit. Nobody should be able to list what everyone else submitted.
  This is the single most commonly missed policy, and it is the one that
  leaks customer email addresses.
- **Everything else behind an admin check** — a `SECURITY DEFINER` function
  comparing the caller's identity against `xx_admins`.

Enable RLS on **every** table, including ones you think are internal. A table
with RLS disabled is readable by anyone holding the publishable key, which is
everyone.

## 4. Put logic in RPCs, not in the browser

Anything with a rule in it goes in a `SECURITY DEFINER` Postgres function
granted to `anon` or `authenticated`. This keeps the rules in one place, out
of the client, and impossible to bypass by calling the REST API directly.

| Function | Caller | Job |
|---|---|---|
| `xx_claim(...)` | anon | Create-or-return. **Idempotent** — submitting twice returns the same record, never a duplicate. |
| `xx_get(code)` | anon | Look up by a secret code. Returns a **masked** email, never the full one. |
| `xx_check_in(code)` | admin | Mutate, and report which of several outcomes happened. |
| `xx_stats()` | admin | Aggregate counts for a dashboard. |

**Return a JSON object with `ok: true/false` and a machine-readable `error`
string** — `invalid_email`, `not_found`, `not_admin` — never a raw Postgres
error. The frontend maps those to human sentences. Raw database errors in a
browser are both a bad experience and an information leak.

**Idempotency is the most valuable property in this table.** It removes
double-bookings, double-charges and double-emails without any client-side
cleverness, and it is what makes a replayed webhook safe.

## 5. Migrations

Apply schema through recorded migrations, never ad-hoc SQL typed into the
dashboard. Test RPCs from SQL with a simulated JWT *before* wiring any UI:

```sql
select public.xx_check_in('CODE123')
from (select set_config('request.jwt.claims',
        json_build_object('email','admin@example.com')::text, true)) s;
```

---

## 6. The login trap — use passwords for staff screens, not magic links

This cost hours on one build, twice over.

1. **Shared project + magic link = wrong site.** Auth redirects fall back to
   the *project's* Site URL when the requested redirect is not in the
   allow-list. A login link for one site dropped the operator on a different
   site's admin page. Fix: **Authentication → URL Configuration → Redirect
   URLs**, add `https://thesite.com/**` *and* the `*.netlify.app/**`
   equivalent. Never change the project's Site URL to fix this — that breaks
   the other site the same way.
2. **Supabase's shared mail server rate-limits login emails to roughly two to
   four per hour.** The operator got locked out of his own admin screen
   mid-setup. Magic links are also single-use and expire, and two
   identical-looking emails in an inbox are indistinguishable except by
   timestamp — the old one got clicked three times.

Email + password has none of those failure modes and works somewhere with no
inbox access. Keep magic link as a fallback under a "Forgot it?" disclosure,
and make its rate-limit error say so in plain words.

---

## 7. Never let a user-visible outcome depend on a second browser request

Found the hard way: a real sign-up saved to the database, but the browser's
CORS preflight to the email function came back 503. The POST never fired, so
nothing errored — the customer got a confirmation screen and no email, and
nobody knew. One in five that morning.

**The fix, and the pattern to reuse:** a server-side sweeper. `pg_cron` +
`pg_net` inside Supabase, running every few minutes, finding any record where
the side effect did not happen and doing it.

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
-- xx_sweep() loops over rows where emailed_at is null, older than a minute,
-- with no hard error recorded, and calls the edge function via net.http_post
select cron.schedule('xx-sweep', '*/5 * * * *', $$select public.xx_sweep();$$);
```

This also covers the tab closed too fast, the dropped wifi and the cold start
that timed out. Any flow with a "did the follow-up actually happen?" column
deserves one.

**Record the outcome in the database, not just on screen.** Columns like
`emailed_at` and `email_error` are what let you prove delivery afterwards, and
what the sweeper reads.

---

## 8. Free-tier ceilings worth knowing before you advertise

| Service | Free limit | What happens at the wall |
|---|---|---|
| Resend | 100 emails/day, 3,000/month | Sends start failing. With owner notifications on, each sign-up costs **two** emails — so ~50 sign-ups/day. |
| Supabase | Free-plan quotas are **org-wide**, shared across every project in the org | A restriction breaks every site in the org at once. |
| Supabase auth email | ~2–4/hour | Staff cannot log in. Another reason for password auth. |
| Netlify | Generous for static sites | Rarely the constraint. |
