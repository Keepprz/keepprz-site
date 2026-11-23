// Cloudflare Pages route for netlify/functions/hit.mjs — the handler lives there (see lib/netlify-on-cloudflare.mjs).
import handler from '../../netlify/functions/hit.mjs';
import { adapt } from '../../lib/netlify-on-cloudflare.mjs';

export const onRequest = adapt(handler);
