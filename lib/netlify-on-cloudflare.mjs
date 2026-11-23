// netlify-on-cloudflare.mjs — v01, 2026-11-22
//
// Runs the site's existing server functions (netlify/functions/*.mjs) on
// Cloudflare Pages without a second copy of them. Each file in /functions is
// one line: it imports a handler from netlify/functions and wraps it with
// adapt(). The handlers stay the single source of truth.
//
// What a handler expects from Netlify, and what it gets here:
//   · process.env.NAME            ← Cloudflare's env bindings, copied in per request
//                                   (wrangler.toml turns on nodejs_compat)
//   · x-nf-client-connection-ip   ← cf-connecting-ip
//   · context.params              ← the Pages route params
//   · context.ip                  ← cf-connecting-ip
//   · context.geo.country.code    ← request.cf.country
//   · X-Content-Type-Options   ← added to every function answer (Netlify adds it from netlify.toml)
//   · context.assetFetch(path)    ← a static file of this site, read straight
//                                   from the deployment (a Pages function must
//                                   not fetch its own public address for it)
import process from 'node:process';

export function adapt(handler) {
  return async ({ request, env, params, waitUntil }) => {
    for (const [name, value] of Object.entries(env || {})) {
      if (typeof value === 'string') process.env[name] = value;
    }

    const ip = request.headers.get('cf-connecting-ip') || '';
    const headers = new Headers(request.headers);
    if (ip) headers.set('x-nf-client-connection-ip', ip);
    const req = new Request(request, { headers });

    const context = {
      params: params || {},
      ip,
      geo: { country: { code: request.cf?.country || null } },
      waitUntil,
      assetFetch: async (path) => {
        // Pages answers /x/index.html and /x.html with a redirect to the clean address: follow it.
        let res = await env.ASSETS.fetch(new URL(path, request.url));
        for (let hop = 0; hop < 3 && res.status >= 300 && res.status < 400 && res.headers.get('location'); hop += 1) {
          res = await env.ASSETS.fetch(new URL(res.headers.get('location'), request.url));
        }
        return res;
      },
    };
    const res = await handler(req, context);
    // public/_headers does not reach a function's answer, so the site-wide header is set here;
    // Netlify's own edge-cache header means nothing on Cloudflare and is not passed on.
    const out = new Response(res.body, res);
    if (!out.headers.has('x-content-type-options')) out.headers.set('X-Content-Type-Options', 'nosniff');
    out.headers.delete('netlify-cdn-cache-control');
    return out;
  };
}
