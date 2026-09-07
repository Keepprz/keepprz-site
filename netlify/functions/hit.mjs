/**
 * TEMPLATE — first-party pageview counter. Drop into <site>/netlify/functions/hit.mjs
 * unchanged. Everything site-specific comes from env vars.
 *
 * See Projects/WEB-ANALYTICS-PLAYBOOK.md.
 *
 * Env (per Netlify site):
 *   SITE_KEY              short slug, must match a row in web_sites (e.g. 'sns')
 *   ANALYTICS_SALT        optional random string; strengthens the daily visitor hash
 *   SUPABASE_URL          optional — defaults to the shared project below. The project
 *                         URL is not a secret; it ships in every client-side Supabase
 *                         app, so it defaults here rather than depending on an env var
 *                         that can go missing.
 *   SUPABASE_SERVICE_KEY  Supabase secret key, sb_secret_... (server-side only).
 *                         SUPABASE_SERVICE_ROLE_KEY is accepted as a fallback: sites
 *                         built before this kit already hold the same project's key
 *                         under that name (Borah Vista, 2026-09-05), and a second copy
 *                         of one credential is a second thing to rotate. Whichever
 *                         name is present, it must be a key for the project above.
 *
 * The beacon posts to /.netlify/functions/hit — same-origin, because cross-domain
 * analytics endpoints are what ad blockers are built to stop.
 */

import { createHash } from 'node:crypto';

const BOT = /bot|crawler|spider|crawl|slurp|bingpreview|headless|lighthouse|pingdom|uptime|curl|wget|python-requests|axios|monitoring|preview|facebookexternalhit|whatsapp|telegram|semrush|ahrefs|dataprovider|screaming/i;

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
  } catch {
    return null;
  }
}

function cleanPath(raw) {
  if (typeof raw !== 'string' || !raw.startsWith('/')) return null;
  const p = raw.split('?')[0].split('#')[0];
  return p.length > 300 ? p.slice(0, 300) : p;
}

export default async (req, context) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const siteKey = process.env.SITE_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || 'https://ijctbrncqzdhrizhwpor.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!siteKey || !serviceKey) {
    console.error('[hit] missing env — need SITE_KEY and SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY)');
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
  const salt = process.env.ANALYTICS_SALT || 'keepprz-analytics';

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
