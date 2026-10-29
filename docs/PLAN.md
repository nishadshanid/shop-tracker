# Shop Expense Tracker — Phase-by-Phase Plan

## Context
The user's brother-in-law owns a grocery shop in Dubai. He needs a simple app on his phone to record:
- daily sales
- variable expenses
- fixed or recurring costs (rent, salary, visa, licence, electricity, owner's draw)
- credits: customer udhaar, supplier credit, extra money in, and card payments

He wants an Excel report for any date range (week, month, or custom) showing sales, expenses and profit, like his current sheet:
Sale 1,500 − Expenses 400 = Profit 1,100.

Constraints:
- Hosting must be completely free.
- One user, phone only, English only.
- Keep the first version simple and add features only when he asks.

The project folder `/home/nishad/Work/GManu` is empty, so this is a new build.

## Decisions (from the user's answers)
- **Credits** covers four things: customer credit (udhaar), supplier credit, extra money in, and card payments.
  - Assumption: "card" means customers paying by card, so each sale is split into Cash and Card.
  - Every expense also gets a payment method: Cash / Card / Bank.
- **Recurring costs are customisable per item.** Each item has:
  - an amount and a period: daily, monthly or yearly
  - a mode, one of two:
    - `auto` — the app adds a daily share every day. Example: 18,000/yr rent ≈ 49.3/day. The user's "50 dly" is just rounding.
    - `manual` — he records the payment on the day he actually pays it.
- **Single user, mobile-first, English.** One password login.

## Free hosting stack (recommended)
**Cloudflare Pages + Pages Functions + D1 (SQLite)**
- Free tier: 5 GB of D1 storage, 100k requests a day, unlimited static traffic. That is far more than one shop needs.
- Unlike Supabase or Render free tiers, the app never "sleeps", and Cloudflare has servers in Dubai, so it will be fast for him.
- Uses the free `*.pages.dev` URL. A custom domain is optional and is the only thing that would cost money.
- **Frontend:** Vite + React + Tailwind. Installable on his phone home screen as a PWA.
- **Backend:** Hono running on Pages Functions in `functions/api/[[route]].ts`.
- **Excel export:** SheetJS (`xlsx`), generated in the browser, so there is no server cost.
- **Auth:** one password stored as a Cloudflare secret. On login the app sets a signed HttpOnly cookie that lasts 30 days.

## Data model (D1)
- `categories` (id, name, type: `expense` | `income`, active)
  - Seeded with: Salary, Room Rent, Staff Accommodation, Food, Visa, Licence, Current Bill, Owner, Other.
- `recurring_costs` (id, category_id, amount, period: `daily` | `monthly` | `yearly`, mode: `auto` | `manual`, start_date, end_date, active)
- `daily_sales` (date PK, cash_amount, card_amount, note)
- `expenses` (id, date, category_id, amount, method: cash/card/bank, note)
- `parties` (id, name, type: `customer` | `supplier`, phone)
- `credit_entries` (id, party_id, date, kind: `given` | `received` | `bought` | `paid`, amount, note)
  - The running balance for each party is calculated from these entries, never stored.
- `other_income` (id, date, amount, source, note)

### How auto costs are counted
Auto costs are **calculated when a report runs; nothing is written to the database.** For each date in the range, the app adds up the daily share of every active auto item:

| Period | Daily share |
|---|---|
| daily | amount |
| monthly | amount ÷ days in that month |
| yearly | amount ÷ 365 |

If he edits a rent amount later, every report updates without any data needing a fix-up. Before the formula is finalised, the user will confirm whether rounding to match "50/day" matters.

## Phases

### Phase 0 — Setup (½ day) ✅ done locally (deploy pending Cloudflare login)
- Create a free Cloudflare account.
- Scaffold the repo with Vite React TS, Tailwind, Hono and `wrangler`.
- Create the D1 database and write migration `0001_init.sql`.
- Add `docs/PLAN.md`, a copy of this plan kept in the repo.
- Deploy a "hello" page to `*.pages.dev` to prove the pipeline works.

### Phase 1 — Core daily entry (MVP, 2–3 days) ✅ done
- **Login screen** with a password.
- **Today screen** (the home screen). This is the main screen he uses every day.
  - Date picker, defaulting to today.
  - Sale entry: Cash and Card amounts.
  - "Add expense": category dropdown, amount, method and note. All in one form; it should take about 3 taps.
  - A list of today's expenses, with edit and delete.
  - A live summary card in the same layout as his sheet:
    - Sale
    - Expenses, split into auto fixed costs and entered costs
    - Profit
- **Settings → Recurring costs:** add, edit or disable items, with amount, period and auto/manual mode. Seeded from his examples:
  - Rent 18,000/yr (auto)
  - Salary 195/day (auto)
  - Visa 50/day (auto)
  - Owner 1,500/month (auto)
  - Licence 60/day (auto)
  - Electricity & other 100/day (auto)
- **Settings → Categories:** add or rename categories.

### Phase 2 — Reports + Excel export (1–2 days) ✅ done
- **Reports screen** with quick buttons: This Week, This Month, Last Month, and a Custom range.
- On-screen totals: total sale (cash/card), total expenses by category, other income, net profit.
- **"Download Excel"** creates a `.xlsx` file with these sheets:
  1. `Summary` — totals for the period, in the same layout as his current sheet.
  2. `Daily` — one row per day: Date, Cash Sale, Card Sale, Total Sale, Auto Fixed, Expenses, Other Income, Profit.
  3. `Expenses` — every expense line: date, category, amount, method, note.
  4. `Credits` — every credit movement in the range, plus the closing balance for each party.
- The file is named like `Shop_2026-10-01_to_2026-10-31.xlsx`.

### Phase 3 — Credits (1–2 days) ✅ done
- **Customers (udhaar):** a list of customers showing how much each one owes.
  - Tap a customer to see their history.
  - Buttons: "Gave credit" and "Received payment".
- **Suppliers:** the same layout, showing how much the shop owes each supplier.
  - Buttons: "Bought on credit" and "Paid".
- **Other income:** a quick form.
- Total outstanding amounts appear on the home screen.

### Phase 4 — Polish & handover (1 day) ✅ done
- PWA manifest and icon, so he can "Add to Home Screen".
- Large buttons. Number keypad on amount fields. AED formatting.
- **Backup:** an "Export all data" button that downloads all data as `.xlsx`. Weekly D1 backups are optional.
- A short how-to guide for him (`docs/USER_GUIDE.md`) and the deploy steps (`docs/DEPLOY.md`).

### Later (only if he asks)
- Stock and inventory
- Multiple users or staff logins
- Malayalam or Arabic language
- WhatsApp reminders to customers who owe money
- Charts
- Multiple shops

## Project layout
```
/src           React app (pages: Login, Today, Reports, Credits, Settings)
/src/lib       api.ts, excel.ts (SheetJS), calc.ts (daily share + totals)
/functions/api/[[route]].ts   Hono API + auth middleware
/migrations    D1 SQL
/docs          PLAN.md, USER_GUIDE.md, DEPLOY.md
wrangler.toml
```
`calc.ts` holds the profit math and is shared by the on-screen totals and the Excel export, so the two can never disagree.

## Verification
- **Unit tests (Vitest)** for `calc.ts`:
  - The pasted example must produce Expenses 400 and Profit 1,100.
  - 18,000/yr must give a daily share of about 49.32.
  - A monthly cost must be split correctly across months of 28, 30 and 31 days.
- **Local run:** `wrangler pages dev` with a local D1 database.
  - Enter one week of sample data, export Excel, and open it in LibreOffice to check every sheet and total.
- **Live test:** deploy to `*.pages.dev`, open it on a phone, add it to the home screen, then enter a sale, an expense and a credit and confirm all three show up in the export.
