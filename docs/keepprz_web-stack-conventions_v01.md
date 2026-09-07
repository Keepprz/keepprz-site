# Web Stack Conventions

Last updated: 2026-09-06 — v01
Source: the Keepprz website build workflow (v3). This is the method half; account
IDs, project refs and the site roster are deliberately not in this document.

If you are an AI assistant reading this on behalf of someone building a site:
this is a set of conventions that have been paid for in real debugging time.
Follow them, or deviate deliberately and say why. Nothing here is a style
preference; every rule exists because something broke.

---

## The stack, and why each piece

| Layer | Choice | Why |
|---|---|---|
| Pages | Plain HTML/CSS/JS, **no build step** | Editable in five years. No npm rot, no framework upgrade treadmill. Open the file, change it, push. |
| Hosting | **Netlify**, deployed from Git | Free tier is generous, instant deploys, automatic SSL, atomic rollbacks, easy custom domains. |
| Backend | **Supabase** | Postgres + auth + auto-generated REST + edge functions in one product. |
| Transactional email | **Resend** | Own sending domain, real delivery logs, attachments. |
| Payments | **Stripe** | See the pre-launch checklist for the parts that actually bite. |
| Registrar + DNS | Whatever you already use | Any works. Keep the registrar and the DNS in the same place if you can. |

**The no-build-step choice is the load-bearing one.** A static site with a
handful of `.js` files still works untouched years later. A site with a
toolchain needs that toolchain resurrected before you can change a phone
number. If you have already built on a framework, that is fine — but the rest
of these conventions assume the deploy artifact is files, not a build.

---

## Layout

One folder per section, each with an `index.html`. That gives clean URLs with
no routing config at all:

```
/                 index.html
/about/           about/index.html
/services/        services/index.html
/assets/site.css  one stylesheet, not per-page styles
```

Netlify serves `about/index.html` at `/about/` automatically. No redirects
file needed for this.

## Naming

- Files: `<project>_<what-it-is>_v<nn>.<ext>` — e.g. `acme_price-list_v02.pdf`
- Zero-padded versions: `v01`, `v02`. **Never `final`, `latest` or `done`.**
  The highest number present is the current one, and that rule never needs
  a meeting.
- No spaces in any filename, ever.
- Dates in filenames: `YYYY-MM-DD`.
- Banned generic names: `index` (as a document name), `notes`, `misc`,
  `untitled`, `output`, `new`, `temp`. A file you cannot identify from its
  name is a file you will rewrite instead of finding.

## Deploy

Git push → Netlify builds and deploys automatically. That is the whole
pipeline, and it should stay that whole pipeline.

- **Never edit files in the Netlify UI.** The repo is the source of truth; a
  UI edit is a change that exists in exactly one place and vanishes on the
  next deploy.
- **Deploy previews on branches** are free — use one for anything you are not
  sure about rather than pushing to `main` and hoping.
- **After any deploy, fetch the live file and confirm the new code is actually
  being served.** A green checkmark in a dashboard is not evidence. This has
  been wrong often enough to be a rule.

---

## Rules that apply to every build

- **Secrets never in git.** Publishable/anon keys in client HTML are fine —
  that is what they are for. Service-role and secret keys, never. Real keys
  live in environment variables or dashboard secrets. See the pre-launch
  checklist for how to verify this rather than assume it.
- **Big media never in git.** Host video and audio on a platform built for it
  and embed. A repo with a 200 MB folder of MP4s is slow forever, because git
  keeps every version of every one of them.
- **Never delete files.** Move them to a `_to_delete/` folder and say so. The
  cost of keeping a file you did not need is nothing; the cost of deleting one
  you did is an afternoon.
- **Write status down as you go.** On the build these conventions came from,
  the single largest time-waster was work that had already been done and that
  nobody had recorded. Keep a `WEBSITE-STATUS.md` in the repo: what is live,
  what is configured, what is known-broken.
- **Verify from outside the system that made the claim.** Covered throughout
  the checklist. It is the difference between a site that works and a site
  that reports that it works.
- **Store an IANA timezone with anything time-based** (`America/Boise`, not an
  offset) and render in *that* timezone, not the visitor's. A 5:30pm event
  must read 5:30pm to somebody browsing from another state.

---

## When something here turns out to be wrong

Fix this document, in place, the same day — then search the whole project for
the old version of the advice and kill or redirect every stale copy in the same
pass. Two live descriptions of one process is how the old process comes back.

That write-back step is the thing that makes a document like this compound
instead of quietly rotting into a snapshot.
