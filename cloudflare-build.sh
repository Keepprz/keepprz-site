#!/bin/sh
# cloudflare-build.sh — v01, 2026-11-22 (the move off Netlify)
#
# keepprz.com is plain HTML with no build step. Netlify published the repo root
# and hid its own files. Cloudflare Pages publishes every file in the output
# folder, so this copies the site into _site/ and leaves the working files out
# (wrangler.toml, functions/, lib/, netlify/, dotfiles, parked folders).
# Cloudflare Pages build command:  sh cloudflare-build.sh     Output folder: _site
set -e
rm -rf _site
mkdir _site
for item in *; do
  case "$item" in
    _site|functions|lib|netlify|netlify.toml|wrangler.toml|cloudflare-build.sh|_to_delete|_mockups|node_modules) ;;
    *) cp -R "$item" _site/ ;;
  esac
done
echo "cloudflare-build: $(find _site -type f | wc -l | tr -d ' ') files in _site/"
