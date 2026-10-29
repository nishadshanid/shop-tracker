// Stand-in for the server, used only by the GitHub Pages demo build.
// Everything is kept in this browser's localStorage and mirrors functions/api/[[route]].ts.
import type { Api } from './api'
import { addDays, todayDubai } from './format'
import type {
  Category, CreditEntry, CreditKind, Expense, OtherIncome, PartyBalance, PartyType, RecurringCost, Sale,
} from './types'

type Party = { id: number; name: string; type: PartyType; phone: string | null }

interface Store {
  nextId: number
  categories: Category[]
  recurring: Omit<RecurringCost, 'category_name'>[]
  sales: Sale[]
  expenses: Omit<Expense, 'category_name'>[]
  income: OtherIncome[]
  parties: Party[]
  credits: Omit<CreditEntry, 'party_name' | 'party_type'>[]
}

const KEY = 'shop-demo-v1'

function seed(): Store {
  const names = ['Salary', 'Room Rent', 'Staff Accommodation', 'Food', 'Visa', 'Licence', 'Current Bill', 'Electricity & Other', 'Owner', 'Other']
  const categories: Category[] = names.map((name, i) => ({ id: i + 1, name, type: 'expense', active: 1 }))
  const cat = (n: string) => names.indexOf(n) + 1
  const start = '2026-01-01'
  const recurring = ([
    ['Room Rent', 18000, 'yearly'], ['Salary', 195, 'daily'], ['Visa', 50, 'daily'],
    ['Owner', 1500, 'monthly'], ['Licence', 60, 'daily'], ['Electricity & Other', 100, 'daily'],
  ] as const).map(([n, amount, period], i) => ({
    id: 100 + i, category_id: cat(n), amount, period, mode: 'auto' as const, start_date: start, end_date: null, active: 1,
  }))

  // A few days of sample entries so the screens aren't empty
  const t = todayDubai()
  const d = (n: number) => addDays(t, -n)
  return {
    nextId: 1000,
    categories,
    recurring,
    sales: [
      { date: d(3), cash_amount: 1200, card_amount: 300, note: null },
      { date: d(2), cash_amount: 1400, card_amount: 250, note: null },
      { date: d(1), cash_amount: 1100, card_amount: 400, note: null },
    ],
    expenses: [
      { id: 200, date: d(3), category_id: cat('Food'), amount: 20, method: 'cash', note: 'Tea' },
      { id: 201, date: d(2), category_id: cat('Current Bill'), amount: 25, method: 'cash', note: null },
      { id: 202, date: d(1), category_id: cat('Other'), amount: 50, method: 'card', note: 'Bags' },
    ],
    income: [{ id: 300, date: d(1), amount: 60, source: 'Refund', note: null }],
    parties: [
      { id: 400, name: 'Ali', type: 'customer', phone: null },
      { id: 401, name: 'Al Ain Foods', type: 'supplier', phone: null },
    ],
    credits: [
      { id: 500, party_id: 400, date: d(5), kind: 'given', amount: 100, note: null },
      { id: 501, party_id: 400, date: d(2), kind: 'received', amount: 40, note: null },
      { id: 502, party_id: 401, date: d(2), kind: 'bought', amount: 1200, note: null },
      { id: 503, party_id: 401, date: d(1), kind: 'paid', amount: 500, note: null },
    ],
  }
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // Storage blocked or corrupt: start fresh
  }
  return seed()
}

let db = load()

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    // Private mode: demo still works until the tab closes
  }
}

export function resetDemo() {
  db = seed()
  save()
}

const ok = <T>(v: T): Promise<T> => Promise.resolve(structuredClone(v))
const fail = (message: string): Promise<never> => Promise.reject(new Error(message))
const newId = () => db.nextId++
const round = (n: number) => Math.round(n * 100) / 100

const catName = (id: number) => db.categories.find((c) => c.id === id)?.name
const withCat = <T extends { category_id: number }>(x: T) => ({ ...x, category_name: catName(x.category_id) })
const party = (id: number) => db.parties.find((p) => p.id === id)

const byDate = <T extends { date: string; id?: number }>(a: T, b: T) =>
  a.date.localeCompare(b.date) || (a.id ?? 0) - (b.id ?? 0)

function balances(until: string): PartyBalance[] {
  return db.parties.map((p) => ({
    ...p,
    balance: db.credits
      .filter((c) => c.party_id === p.id && c.date <= until)
      .reduce((s, c) => s + (c.kind === 'given' || c.kind === 'bought' ? c.amount : -c.amount), 0),
  }))
}

const KINDS_FOR: Record<PartyType, CreditKind[]> = { customer: ['given', 'received'], supplier: ['bought', 'paid'] }

export const demoApi: Api = {
  me: () => ok({ ok: true as const }),
  login: () => ok({}),
  logout: () => ok({}),

  categories: () => ok([...db.categories].sort((a, b) => a.name.localeCompare(b.name))),
  addCategory: (name) => {
    if (!name.trim()) return fail('Name is required')
    if (db.categories.some((c) => c.name.toLowerCase() === name.trim().toLowerCase())) return fail('That category already exists')
    const c: Category = { id: newId(), name: name.trim(), type: 'expense', active: 1 }
    db.categories.push(c)
    save()
    return ok(c)
  },
  updateCategory: (c) => {
    const i = db.categories.findIndex((x) => x.id === c.id)
    if (i < 0) return fail('Not found')
    db.categories[i] = { ...db.categories[i], name: c.name.trim(), active: c.active ? 1 : 0 }
    save()
    return ok(db.categories[i])
  },

  recurring: () =>
    ok(db.recurring.map(withCat).sort((a, b) => b.active - a.active || (a.category_name ?? '').localeCompare(b.category_name ?? ''))),
  saveRecurring: (r) => {
    const { category_name: _, ...fields } = { ...r, amount: round(r.amount), active: r.active ? 1 : 0 }
    if (fields.id) {
      const i = db.recurring.findIndex((x) => x.id === fields.id)
      db.recurring[i] = fields as Store['recurring'][number]
    } else {
      fields.id = newId()
      db.recurring.push(fields as Store['recurring'][number])
    }
    save()
    return ok(withCat(db.recurring.find((x) => x.id === fields.id)!))
  },

  exportAll: () =>
    ok({
      daily_sales: db.sales, expenses: db.expenses, other_income: db.income, categories: db.categories,
      recurring_costs: db.recurring, parties: db.parties, credit_entries: db.credits,
    } as unknown as Record<string, Record<string, unknown>[]>),

  report: (from, to) => {
    if (from > to) return fail('From date is after To date')
    const inRange = (x: { date: string }) => x.date >= from && x.date <= to
    return ok({
      from,
      to,
      sales: db.sales.filter(inRange).sort(byDate),
      expenses: db.expenses.filter(inRange).sort(byDate).map(withCat),
      recurring: db.recurring.map(withCat),
      otherIncome: db.income.filter(inRange).sort(byDate),
      credits: db.credits.filter(inRange).sort(byDate).map((c) => ({
        ...c, party_name: party(c.party_id)?.name, party_type: party(c.party_id)?.type,
      })),
      balances: balances(to).sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name)),
    })
  },

  day: (date) =>
    ok({
      sale: db.sales.find((s) => s.date === date) ?? null,
      expenses: db.expenses.filter((e) => e.date === date).sort(byDate).map(withCat),
      otherIncome: db.income.filter((i) => i.date === date).sort(byDate),
    }),
  saveSale: (s) => {
    const sale = { ...s, cash_amount: round(s.cash_amount), card_amount: round(s.card_amount) }
    db.sales = [...db.sales.filter((x) => x.date !== s.date), sale]
    save()
    return ok(sale)
  },
  saveExpense: (e) => {
    if (!(e.amount > 0)) return fail('Invalid amount')
    const { category_name: _, ...fields } = { ...e, amount: round(e.amount) }
    if (fields.id) {
      const i = db.expenses.findIndex((x) => x.id === fields.id)
      if (i < 0) return fail('Not found')
      db.expenses[i] = fields as Store['expenses'][number]
    } else {
      fields.id = newId()
      db.expenses.push(fields as Store['expenses'][number])
    }
    save()
    return ok(db.expenses.find((x) => x.id === fields.id)!)
  },
  deleteExpense: (id) => {
    db.expenses = db.expenses.filter((x) => x.id !== id)
    save()
    return ok({})
  },

  addIncome: (i) => {
    const row = { ...i, id: newId(), amount: round(i.amount) }
    db.income.push(row)
    save()
    return ok(row)
  },
  deleteIncome: (id) => {
    db.income = db.income.filter((x) => x.id !== id)
    save()
    return ok({})
  },

  parties: () =>
    ok(balances('9999-12-31').sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name))),
  addParty: (p) => {
    if (!p.name.trim()) return fail('Name is required')
    const row: Party = { id: newId(), name: p.name.trim(), type: p.type, phone: p.phone }
    db.parties.push(row)
    save()
    return ok({ ...row, balance: 0 })
  },
  updateParty: (id, p) => {
    const row = party(id)
    if (!row) return fail('Not found')
    Object.assign(row, { name: p.name.trim(), phone: p.phone })
    save()
    return ok({})
  },
  partyEntries: (id) =>
    ok(db.credits.filter((c) => c.party_id === id).sort((a, b) => byDate(b, a))),
  addCredit: (e) => {
    const p = party(e.party_id)
    if (!p) return fail('Customer or supplier not found')
    if (!KINDS_FOR[p.type].includes(e.kind)) return fail('Invalid entry type')
    const row = { ...e, id: newId(), amount: round(e.amount) }
    db.credits.push(row)
    save()
    return ok(row)
  },
  deleteCredit: (id) => {
    db.credits = db.credits.filter((x) => x.id !== id)
    save()
    return ok({})
  },
}
