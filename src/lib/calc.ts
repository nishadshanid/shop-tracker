import type { Expense, RecurringCost, ReportData, Sale } from './types'

// Dates are plain 'YYYY-MM-DD' strings throughout the app.

export function daysInMonth(date: string): number {
  const [y, m] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

// The share of a recurring cost that belongs to one day.
export function dailyShare(cost: Pick<RecurringCost, 'amount' | 'period'>, date: string): number {
  switch (cost.period) {
    case 'daily':
      return cost.amount
    case 'monthly':
      return cost.amount / daysInMonth(date)
    case 'yearly':
      return cost.amount / 365
  }
}

export function appliesOn(cost: RecurringCost, date: string): boolean {
  return (
    cost.mode === 'auto' &&
    !!cost.active &&
    cost.start_date <= date &&
    (!cost.end_date || cost.end_date >= date)
  )
}

export interface AutoLine {
  name: string
  amount: number
}

export function autoCostsFor(costs: RecurringCost[], date: string): AutoLine[] {
  return costs
    .filter((c) => appliesOn(c, date))
    .map((c) => ({ name: c.category_name ?? '', amount: dailyShare(c, date) }))
}

export interface DaySummary {
  cashSale: number
  cardSale: number
  totalSale: number
  autoLines: AutoLine[]
  autoTotal: number
  enteredTotal: number
  totalExpenses: number
  otherIncome: number
  profit: number
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

export function summarizeDay(
  date: string,
  sale: Sale | null,
  expenses: Expense[],
  costs: RecurringCost[],
  otherIncome = 0,
): DaySummary {
  const cashSale = sale?.cash_amount ?? 0
  const cardSale = sale?.card_amount ?? 0
  const totalSale = cashSale + cardSale
  const autoLines = autoCostsFor(costs, date)
  const autoTotal = sum(autoLines.map((l) => l.amount))
  const enteredTotal = sum(expenses.map((e) => e.amount))
  const totalExpenses = autoTotal + enteredTotal
  return {
    cashSale,
    cardSale,
    totalSale,
    autoLines,
    autoTotal,
    enteredTotal,
    totalExpenses,
    otherIncome,
    profit: totalSale + otherIncome - totalExpenses,
  }
}

export function datesBetween(from: string, to: string): string[] {
  const dates: string[] = []
  const d = new Date(`${from}T00:00:00Z`)
  for (let s = from; s <= to; s = d.toISOString().slice(0, 10)) {
    dates.push(s)
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return dates
}

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const it of items) m.set(key(it), [...(m.get(key(it)) ?? []), it])
  return m
}

export interface RangeSummary {
  days: (DaySummary & { date: string })[]
  totals: Omit<DaySummary, 'autoLines'>
  // Fixed (auto) and entered expenses combined per category, largest first
  byCategory: { name: string; amount: number }[]
}

export function summarizeRange(data: ReportData): RangeSummary {
  const sales = new Map(data.sales.map((s) => [s.date, s]))
  const expenses = groupBy(data.expenses, (e) => e.date)
  const income = groupBy(data.otherIncome, (i) => i.date)

  const days = datesBetween(data.from, data.to).map((date) => ({
    date,
    ...summarizeDay(
      date,
      sales.get(date) ?? null,
      expenses.get(date) ?? [],
      data.recurring,
      sum((income.get(date) ?? []).map((i) => i.amount)),
    ),
  }))

  const total = (k: Exclude<keyof DaySummary, 'autoLines'>) => sum(days.map((d) => d[k]))
  const byCat = new Map<string, number>()
  const add = (name: string, amount: number) => byCat.set(name, (byCat.get(name) ?? 0) + amount)
  for (const d of days) for (const l of d.autoLines) add(l.name, l.amount)
  for (const e of data.expenses) add(e.category_name ?? 'Other', e.amount)

  return {
    days,
    totals: {
      cashSale: total('cashSale'),
      cardSale: total('cardSale'),
      totalSale: total('totalSale'),
      autoTotal: total('autoTotal'),
      enteredTotal: total('enteredTotal'),
      totalExpenses: total('totalExpenses'),
      otherIncome: total('otherIncome'),
      profit: total('profit'),
    },
    byCategory: [...byCat].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount),
  }
}
