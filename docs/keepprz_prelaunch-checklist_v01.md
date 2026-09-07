# Pre-Launch Checklist

Last updated: 2026-09-06 — v01
Source: the Keepprz website build workflow (v3), Phase 8 and the pre-launch
list, plus the Stripe money-to-ticket design.

Work through this against the **live site on the real domain**, not a local
copy and not a deploy preview. Every item is here because it went wrong on a
real build.

**The governing rule: never report something as working because a screen said
so.** Every claim gets checked from outside the system that made it. A
dashboard's green checkmark is the claim, not the evidence.

---

## Secrets — do this one first

- [ ] **Search the repo for keys before the first public deploy.** Look for
      `sb_secret`, `service_role`, `sk_live`, `sk_test`, `whsec_`, `Bearer `,
      and any `.env` that is not gitignored. A key that ever reached a public
      repo must be rotated, not deleted — the history keeps it.
- [ ] **Open the deployed site's JS bundle in a browser and search it** for the
      same strings. This is the check that matters: not what you meant to ship,
      what actually shipped.
- [ ] Publishable / anon keys in client code: fine, that is their purpose.
- [ ] Secret / service-role keys: environment variables only, server-side only.
- [ ] `.env` is in `.gitignore`, and `git status` is clean of it.

## Row-level security

- [ ] **RLS is enabled on every table.** Not most. Every one, including the
      ones you think of as internal.
- [ ] **Test as a stranger:** open a private window, take the publishable key
      out of your own HTML, and try to `select` from each table with it. You
      should get back only what you intend the public to see.
- [ ] Sign-up / order tables accept **insert** from the public but return
      **no rows on read**. This is the policy most often missed and the one
      that leaks customer email addresses.
- [ ] Admin screens are gated by a database check, not by hiding the URL.
- [ ] Test records deleted so real ones are not mixed in with them.

## Stripe — the part that actually bites

Taking the money is the easy half. Connecting a payment to what the customer
bought is where sites break, and the failure mode is the worst one available:
**someone pays and gets nothing.**

- [ ] **The webhook signature is verified.** Non-negotiable. Without it,
      anyone who finds your endpoint can post a fake `checkout.session.completed`
      and mint themselves a free order. This is the single most important line
      of code in a payment integration.
- [ ] **Fulfilment is driven by the webhook, not by the browser redirect.** The
      success page is a courtesy — the customer closes the tab, loses signal,
      or never lands on it. If the redirect is what creates the order, some
      customers pay and get nothing, and you will not find out.
- [ ] **Store `stripe_session_id` with a UNIQUE constraint.** This is what
      makes a replayed webhook safe. Stripe retries; it is supposed to. Your
      handler must be idempotent, and a unique column is the cheapest way to
      get there.
- [ ] Record `amount_paid`, `currency`, `quantity` and `refunded_at` on the
      order row. Money that exists only in Stripe's dashboard is money you
      cannot reconcile against your own records.
- [ ] **Handle `charge.refunded`** — void the order. Otherwise a refunded
      customer still has a valid ticket / booking / download.
- [ ] **Test and live keys are not mixed.** Confirm which mode the deployed
      site is in by making a real charge, not by reading config.
- [ ] **Do one real end-to-end charge on the live site with a real card, then
      refund it.** Test mode does not exercise the live keys, the live webhook
      endpoint, or the live redirect URL — which are three of the things most
      likely to be wrong.

## The site itself

- [ ] Every page loads on the real domain over HTTPS with a valid certificate.
- [ ] No nav link 404s. Click every one.
- [ ] Forms tested end to end **from the live site**.
- [ ] Confirmed **in the database** that the side effect (email, order row)
      actually happened — not that the screen said it did.
- [ ] Email tested to an address that is **not** the platform account owner's.
      Mail to yourself takes a different path and proves less than you think.
- [ ] Reply-to points somewhere a human reads.
- [ ] The owner gets notified when someone signs up or buys.
- [ ] A sweeper/cron exists for any deferred side effect (see the Supabase
      conventions, §7).
- [ ] Admin screens tested on the actual phone that will be used, not a
      desktop browser resized.
- [ ] Every page checked at phone width. Most traffic is phones.
- [ ] Page `<title>` and meta description set per page — not the same on all.
- [ ] An OG image is set, and the link has been pasted into a real chat to see
      what it renders as.
- [ ] A favicon exists.
- [ ] Analytics installed and **verified by reading a row back** (see the
      analytics doc, §6).

## DNS and domain

- [ ] **MX records intact** if the domain receives mail. Changing a site's DNS
      has taken down a working inbox more than once.
- [ ] After DNS changes, query public DNS directly for each record. Watch for
      cached answers — a stale reply once made a live page get reported as a
      404.
- [ ] After SSL, open a TLS connection and read the certificate's SAN list.
- [ ] `www` and the apex both resolve, one redirecting to the other.

## Free-tier headroom

- [ ] Understood before you advertise. Email is usually the first wall: a
      100/day limit is ~50 sign-ups/day once owner notifications double each
      one. Running out of email quota during a launch push is a bad afternoon.

## Last

- [ ] **After the final deploy, fetch the live files and confirm the new code
      is actually being served.** Not the dashboard's word for it.
- [ ] Repo status file updated: what is live, what is configured, what is
      known-broken.
- [ ] **Anything this launch taught that is not in these documents gets
      written into them today** — then search the project for the old version
      of that advice and remove it. Two live descriptions of one process is
      how the old process comes back.

---

## When something is odd, read the logs

Supabase auth logs, edge function logs, and `function_edge_logs` explained
every mystery on the build these notes came from — the magic link that landed
on the wrong site, the emails that never sent, all of it.

Do not theorize. Query.
