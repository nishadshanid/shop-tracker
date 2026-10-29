# Shop Tracker

A simple tracker for a grocery shop's daily sales, expenses, fixed costs and credits, with Excel export. It is hosted for free on Cloudflare Pages + D1.

The full phase-by-phase plan is in [docs/PLAN.md](docs/PLAN.md).

## Local development
```bash
npm install
npm run db:migrate:local      # create the local SQLite DB with seed data
npm run pages:dev             # build + serve app and API at http://localhost:8788
```
The local password is set in `.dev.vars` (`APP_PASSWORD`).

## Deploying
See [docs/DEPLOY.md](docs/DEPLOY.md). It covers first deploy, updates, changing the password and backups.

## For the shop owner
See [docs/USER_GUIDE.md](docs/USER_GUIDE.md).

## Demo on GitHub Pages
Every push to `main` publishes a **demo version** to GitHub Pages (`.github/workflows/demo-pages.yml`).
The demo has no server: it opens without a password and keeps entries in that browser only.
Use it to check the screens; the real app runs on Cloudflare.

Build it locally with `VITE_DEMO=true npx vite build`.
