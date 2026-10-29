# Deploying and running Shop Tracker

Everything runs on Cloudflare's free plan: Pages for the site and API, D1 for the database.
No credit card is needed.

## First deploy (one time)
```bash
npm install
npx wrangler login                                   # opens the browser; use a free Cloudflare account
npx wrangler d1 create shop-tracker-db               # prints a database_id
# paste that database_id into wrangler.toml (replace REPLACE_AFTER_wrangler_d1_create)
npm run db:migrate:remote                            # creates the tables and his starting categories/fixed costs
npx wrangler pages project create shop-tracker --production-branch main
npx wrangler pages secret put APP_PASSWORD --project-name shop-tracker   # choose a strong password
npm run deploy
```
The app is then live at `https://shop-tracker.pages.dev`. If that name is taken, Cloudflare will
show the actual URL.

## Updating the app
```bash
npm test && npm run deploy
```
If a new file was added under `migrations/`, run `npm run db:migrate:remote` first.

## Changing the password
```bash
npx wrangler pages secret put APP_PASSWORD --project-name shop-tracker
npm run deploy
```
Changing it logs out every phone, because sessions are signed with the password.

## Backups
1. **In the app:** Settings → Download full backup (Excel). Ask him to do this monthly.
2. **Database export:**
   `npx wrangler d1 export shop-tracker-db --remote --output=backup-$(date +%F).sql`
3. **Undo a mistake (Time Travel):** D1 keeps point-in-time history (7 days on the free plan):
   ```bash
   npx wrangler d1 time-travel info shop-tracker-db
   npx wrangler d1 time-travel restore shop-tracker-db --timestamp=2026-10-29T10:00:00+04:00
   ```

## Free plan limits (far above what one shop needs)
- D1: 5 GB storage, 5 million row reads/day, 100k row writes/day
- Pages Functions: 100k requests/day
- Optional custom domain (e.g. `myshop.ae`) is the only thing that would cost money.

## Local development
```bash
npm run db:migrate:local
npm run pages:dev        # http://localhost:8788, password from .dev.vars
npm test
```
