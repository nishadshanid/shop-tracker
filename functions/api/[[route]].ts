import { Hono } from 'hono'
import { handle } from 'hono/cloudflare-pages'
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie'
import { HTTPException } from 'hono/http-exception'

type Env = { DB: D1Database; APP_PASSWORD: string }

const SESSION = 'session'
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const PERIODS = ['daily', 'monthly', 'yearly']
const MODES = ['auto', 'manual']
const METHODS = ['cash', 'card', 'bank']

const app = new Hono<{ Bindings: Env }>().basePath('/api')

// --- small validators -------------------------------------------------------

function bad(message: string): never {
  throw new HTTPException(400, { message })
}

function date(v: unknown): string {
  if (typeof v !== 'string' || !DATE_RE.test(v)) bad('Invalid date')
  return v
}

function amount(v: unknown): number {
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0) bad('Invalid amount')
  return Math.round(n * 100) / 100
}

function oneOf(v: unknown, allowed: string[], field: string): string {
  if (typeof v !== 'string' || !allowed.includes(v)) bad(`Invalid ${field}`)
  return v
}

function text(v: unknown): string | null {
  if (v == null || v === '') return null
  return String(v).trim().slice(0, 200) || null
}

function id(v: string): number {
  const n = Number(v)
  if (!Number.isInteger(n) || n <= 0) bad('Invalid id')
  return n
}

// --- auth -------------------------------------------------------------------

app.get('/health', (c) => c.json({ ok: true }))

app.post('/login', async (c) => {
  const { password } = await c.req.json<{ password?: string }>()
  if (!c.env.APP_PASSWORD || password !== c.env.APP_PASSWORD) {
    // Slow down anyone guessing passwords
    await new Promise((r) => setTimeout(r, 1000))
    return c.json({ error: 'Wrong password' }, 401)
  }
  // Signing with the password means changing the password logs everyone out.
  await setSignedCookie(c, SESSION, 'owner', c.env.APP_PASSWORD, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return c.json({ ok: true })
})

app.post('/logout', (c) => {
  deleteCookie(c, SESSION, { path: '/' })
  return c.json({ ok: true })
})

app.use('*', async (c, next) => {
  const session = await getSignedCookie(c, c.env.APP_PASSWORD, SESSION)
  if (session !== 'owner') return c.json({ error: 'Not logged in' }, 401)
  await next()
})

app.get('/me', (c) => c.json({ ok: true }))

// --- categories -------------------------------------------------------------

app.get('/categories', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM categories ORDER BY name').all()
  return c.json(results)
})

app.post('/categories', async (c) => {
  const b = await c.req.json()
  const name = text(b.name) ?? bad('Name is required')
  const row = await c.env.DB.prepare('INSERT INTO categories (name) VALUES (?) RETURNING *')
    .bind(name)
    .first()
  return c.json(row, 201)
})

app.put('/categories/:id', async (c) => {
  const b = await c.req.json()
  const name = text(b.name) ?? bad('Name is required')
  const row = await c.env.DB.prepare('UPDATE categories SET name = ?, active = ? WHERE id = ? RETURNING *')
    .bind(name, b.active ? 1 : 0, id(c.req.param('id')))
    .first()
  return row ? c.json(row) : c.json({ error: 'Not found' }, 404)
})

// --- recurring costs --------------------------------------------------------

const RECURRING_SELECT = `
  SELECT r.*, cat.name AS category_name
  FROM recurring_costs r JOIN categories cat ON cat.id = r.category_id`

function recurringFields(b: Record<string, unknown>) {
  return [
    Number(b.category_id) || bad('Category is required'),
    amount(b.amount),
    oneOf(b.period, PERIODS, 'period'),
    oneOf(b.mode, MODES, 'mode'),
    date(b.start_date),
    b.end_date ? date(b.end_date) : null,
    b.active === undefined || b.active ? 1 : 0,
  ]
}

app.get('/recurring', async (c) => {
  const { results } = await c.env.DB.prepare(`${RECURRING_SELECT} ORDER BY r.active DESC, cat.name`).all()
  return c.json(results)
})

app.post('/recurring', async (c) => {
  const { id: newId } = (await c.env.DB.prepare(
    `INSERT INTO recurring_costs (category_id, amount, period, mode, start_date, end_date, active)
     VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  )
    .bind(...recurringFields(await c.req.json()))
    .first<{ id: number }>())!
  return c.json(await c.env.DB.prepare(`${RECURRING_SELECT} WHERE r.id = ?`).bind(newId).first(), 201)
})

app.put('/recurring/:id', async (c) => {
  const rid = id(c.req.param('id'))
  await c.env.DB.prepare(
    `UPDATE recurring_costs SET category_id = ?, amount = ?, period = ?, mode = ?,
       start_date = ?, end_date = ?, active = ? WHERE id = ?`,
  )
    .bind(...recurringFields(await c.req.json()), rid)
    .run()
  return c.json(await c.env.DB.prepare(`${RECURRING_SELECT} WHERE r.id = ?`).bind(rid).first())
})

// --- one day: sale + expenses -----------------------------------------------

app.get('/day/:date', async (c) => {
  const d = date(c.req.param('date'))
  const [sale, expenses, otherIncome] = await c.env.DB.batch([
    c.env.DB.prepare('SELECT * FROM daily_sales WHERE date = ?').bind(d),
    c.env.DB.prepare(
      `SELECT e.*, cat.name AS category_name FROM expenses e
       JOIN categories cat ON cat.id = e.category_id WHERE e.date = ? ORDER BY e.id`,
    ).bind(d),
    c.env.DB.prepare('SELECT * FROM other_income WHERE date = ? ORDER BY id').bind(d),
  ])
  return c.json({ sale: sale.results[0] ?? null, expenses: expenses.results, otherIncome: otherIncome.results })
})

app.put('/sales/:date', async (c) => {
  const b = await c.req.json()
  const row = await c.env.DB.prepare(
    `INSERT INTO daily_sales (date, cash_amount, card_amount, note) VALUES (?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET cash_amount = excluded.cash_amount,
       card_amount = excluded.card_amount, note = excluded.note
     RETURNING *`,
  )
    .bind(date(c.req.param('date')), amount(b.cash_amount), amount(b.card_amount), text(b.note))
    .first()
  return c.json(row)
})

function expenseFields(b: Record<string, unknown>) {
  return [
    date(b.date),
    Number(b.category_id) || bad('Category is required'),
    amount(b.amount),
    oneOf(b.method ?? 'cash', METHODS, 'method'),
    text(b.note),
  ]
}

app.post('/expenses', async (c) => {
  const row = await c.env.DB.prepare(
    'INSERT INTO expenses (date, category_id, amount, method, note) VALUES (?, ?, ?, ?, ?) RETURNING *',
  )
    .bind(...expenseFields(await c.req.json()))
    .first()
  return c.json(row, 201)
})

app.put('/expenses/:id', async (c) => {
  const row = await c.env.DB.prepare(
    'UPDATE expenses SET date = ?, category_id = ?, amount = ?, method = ?, note = ? WHERE id = ? RETURNING *',
  )
    .bind(...expenseFields(await c.req.json()), id(c.req.param('id')))
    .first()
  return row ? c.json(row) : c.json({ error: 'Not found' }, 404)
})

app.delete('/expenses/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM expenses WHERE id = ?').bind(id(c.req.param('id'))).run()
  return c.json({ ok: true })
})

// --- other income -----------------------------------------------------------

app.post('/income', async (c) => {
  const b = await c.req.json()
  const row = await c.env.DB.prepare(
    'INSERT INTO other_income (date, amount, source, note) VALUES (?, ?, ?, ?) RETURNING *',
  )
    .bind(date(b.date), amount(b.amount), text(b.source), text(b.note))
    .first()
  return c.json(row, 201)
})

app.delete('/income/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM other_income WHERE id = ?').bind(id(c.req.param('id'))).run()
  return c.json({ ok: true })
})

// --- customers / suppliers and their credit ---------------------------------

const PARTY_TYPES = ['customer', 'supplier']
// Which entries make sense for each side
const KINDS_FOR: Record<string, string[]> = {
  customer: ['given', 'received'],
  supplier: ['bought', 'paid'],
}

// Customer balance = what they owe us; supplier balance = what we owe them
const balanceSelect = (until: string) => `
  SELECT p.id, p.name, p.type, p.phone, COALESCE(SUM(CASE
    WHEN ce.kind IN ('given', 'bought') THEN ce.amount
    WHEN ce.kind IN ('received', 'paid') THEN -ce.amount END), 0) AS balance
  FROM parties p LEFT JOIN credit_entries ce ON ce.party_id = p.id AND ce.date <= ${until}`

app.get('/parties', async (c) => {
  const { results } = await c.env.DB.prepare(
    `${balanceSelect("'9999-12-31'")} GROUP BY p.id ORDER BY balance DESC, p.name`,
  ).all()
  return c.json(results)
})

app.post('/parties', async (c) => {
  const b = await c.req.json()
  const row = await c.env.DB.prepare('INSERT INTO parties (name, type, phone) VALUES (?, ?, ?) RETURNING *')
    .bind(text(b.name) ?? bad('Name is required'), oneOf(b.type, PARTY_TYPES, 'type'), text(b.phone))
    .first()
  return c.json({ ...row, balance: 0 }, 201)
})

app.put('/parties/:id', async (c) => {
  const b = await c.req.json()
  const row = await c.env.DB.prepare('UPDATE parties SET name = ?, phone = ? WHERE id = ? RETURNING id')
    .bind(text(b.name) ?? bad('Name is required'), text(b.phone), id(c.req.param('id')))
    .first()
  return row ? c.json({ ok: true }) : c.json({ error: 'Not found' }, 404)
})

app.get('/parties/:id/entries', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM credit_entries WHERE party_id = ? ORDER BY date DESC, id DESC',
  )
    .bind(id(c.req.param('id')))
    .all()
  return c.json(results)
})

app.post('/credits', async (c) => {
  const b = await c.req.json()
  const party = await c.env.DB.prepare('SELECT type FROM parties WHERE id = ?')
    .bind(Number(b.party_id) || 0)
    .first<{ type: string }>()
  if (!party) bad('Customer or supplier not found')
  const row = await c.env.DB.prepare(
    'INSERT INTO credit_entries (party_id, date, kind, amount, note) VALUES (?, ?, ?, ?, ?) RETURNING *',
  )
    .bind(b.party_id, date(b.date), oneOf(b.kind, KINDS_FOR[party.type], 'entry type'), amount(b.amount), text(b.note))
    .first()
  return c.json(row, 201)
})

app.delete('/credits/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM credit_entries WHERE id = ?').bind(id(c.req.param('id'))).run()
  return c.json({ ok: true })
})

// --- report for a date range ------------------------------------------------

const MAX_REPORT_DAYS = 732

app.get('/report', async (c) => {
  const from = date(c.req.query('from'))
  const to = date(c.req.query('to'))
  if (from > to) bad('From date is after To date')
  if ((Date.parse(to) - Date.parse(from)) / 86_400_000 > MAX_REPORT_DAYS) bad('Pick a range of 2 years or less')

  const db = c.env.DB
  const [sales, expenses, recurring, otherIncome, credits, balances] = await db.batch([
    db.prepare('SELECT * FROM daily_sales WHERE date BETWEEN ? AND ? ORDER BY date').bind(from, to),
    db.prepare(
      `SELECT e.*, cat.name AS category_name FROM expenses e
       JOIN categories cat ON cat.id = e.category_id
       WHERE e.date BETWEEN ? AND ? ORDER BY e.date, e.id`,
    ).bind(from, to),
    db.prepare(RECURRING_SELECT),
    db.prepare('SELECT * FROM other_income WHERE date BETWEEN ? AND ? ORDER BY date, id').bind(from, to),
    db.prepare(
      `SELECT ce.*, p.name AS party_name, p.type AS party_type FROM credit_entries ce
       JOIN parties p ON p.id = ce.party_id
       WHERE ce.date BETWEEN ? AND ? ORDER BY ce.date, ce.id`,
    ).bind(from, to),
    // Balances as of the To date
    db.prepare(`${balanceSelect('?')} GROUP BY p.id ORDER BY p.type, p.name`).bind(to),
  ])

  return c.json({
    from,
    to,
    sales: sales.results,
    expenses: expenses.results,
    recurring: recurring.results,
    otherIncome: otherIncome.results,
    credits: credits.results,
    balances: balances.results,
  })
})

// --- full backup ------------------------------------------------------------

const BACKUP_TABLES = [
  'daily_sales', 'expenses', 'other_income', 'categories', 'recurring_costs', 'parties', 'credit_entries',
] as const

app.get('/export', async (c) => {
  const results = await c.env.DB.batch(
    BACKUP_TABLES.map((t) => c.env.DB.prepare(`SELECT * FROM ${t} ORDER BY ${t === 'daily_sales' ? 'date' : 'id'}`)),
  )
  return c.json(Object.fromEntries(BACKUP_TABLES.map((t, i) => [t, results[i].results])))
})

app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status)
  console.error(err)
  return c.json({ error: 'Something went wrong' }, 500)
})

export const onRequest = handle(app)
