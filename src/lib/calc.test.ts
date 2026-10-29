import { describe, expect, it } from 'vitest'
import { dailyShare, daysInMonth, summarizeDay, summarizeRange } from './calc'
import type { Expense, RecurringCost } from './types'

const cost = (o: Partial<RecurringCost>): RecurringCost => ({
  id: 1, category_id: 1, category_name: 'X', amount: 0, period: 'daily',
  mode: 'auto', start_date: '2026-01-01', end_date: null, active: 1, ...o,
})

const exp = (amount: number): Expense => ({
  id: 1, date: '2026-10-29', category_id: 1, amount, method: 'cash', note: null,
})

describe('dailyShare', () => {
  it('splits a yearly cost over 365 days', () => {
    expect(dailyShare({ amount: 18000, period: 'yearly' }, '2026-10-29')).toBeCloseTo(49.32, 2)
  })

  it('splits a monthly cost by the days in that month', () => {
    expect(daysInMonth('2026-02-10')).toBe(28)
    expect(daysInMonth('2028-02-10')).toBe(29)
    expect(daysInMonth('2026-04-10')).toBe(30)
    expect(daysInMonth('2026-10-10')).toBe(31)
    expect(dailyShare({ amount: 1500, period: 'monthly' }, '2026-04-10')).toBe(50)
    expect(dailyShare({ amount: 1500, period: 'monthly' }, '2026-10-10')).toBeCloseTo(48.39, 2)
  })
})

describe('summarizeDay', () => {
  it('matches his sheet: sale 1,500, expenses 400, profit 1,100', () => {
    const entered = [200, 50, 30, 20, 15, 10, 25, 50].map(exp)
    const s = summarizeDay('2026-10-29', { date: '2026-10-29', cash_amount: 1500, card_amount: 0, note: null }, entered, [])
    expect(s.totalExpenses).toBe(400)
    expect(s.profit).toBe(1100)
  })

  it('adds auto costs, and skips manual, inactive, and out-of-range ones', () => {
    const costs = [
      cost({ amount: 195 }),
      cost({ amount: 100, mode: 'manual' }),
      cost({ amount: 100, active: 0 }),
      cost({ amount: 100, start_date: '2026-11-01' }),
      cost({ amount: 100, end_date: '2026-10-28' }),
    ]
    const s = summarizeDay('2026-10-29', { date: '2026-10-29', cash_amount: 1000, card_amount: 500, note: null }, [exp(5)], costs)
    expect(s.totalSale).toBe(1500)
    expect(s.autoTotal).toBe(195)
    expect(s.totalExpenses).toBe(200)
    expect(s.profit).toBe(1300)
  })
})

describe('summarizeRange', () => {
  it('totals days across a month boundary, including days with no entries', () => {
    const r = summarizeRange({
      from: '2026-09-30',
      to: '2026-10-02',
      sales: [
        { date: '2026-09-30', cash_amount: 1000, card_amount: 0, note: null },
        { date: '2026-10-01', cash_amount: 500, card_amount: 500, note: null },
      ],
      expenses: [{ ...exp(30), date: '2026-10-01', category_name: 'Food' }],
      recurring: [cost({ amount: 3000, period: 'monthly', category_name: 'Owner' })],
      otherIncome: [{ id: 1, date: '2026-10-02', amount: 10, source: null, note: null }],
      credits: [],
      balances: [],
    })
    expect(r.days.map((d) => d.date)).toEqual(['2026-09-30', '2026-10-01', '2026-10-02'])
    // Owner: 3000/30 in September, 3000/31 in October
    expect(r.totals.autoTotal).toBeCloseTo(100 + (2 * 3000) / 31, 6)
    expect(r.totals.totalSale).toBe(2000)
    expect(r.totals.otherIncome).toBe(10)
    expect(r.totals.profit).toBeCloseTo(2000 + 10 - 30 - r.totals.autoTotal, 6)
    expect(r.byCategory[0].name).toBe('Owner')
    expect(r.byCategory[1]).toEqual({ name: 'Food', amount: 30 })
  })
})

describe('week and month starts', () => {
  it('starts weeks on Monday', async () => {
    const { startOfWeek, startOfMonth } = await import('./format')
    expect(startOfWeek('2026-10-29')).toBe('2026-10-26') // Thursday -> Monday
    expect(startOfWeek('2026-10-26')).toBe('2026-10-26')
    expect(startOfWeek('2026-11-01')).toBe('2026-10-26') // Sunday -> previous Monday
    expect(startOfMonth('2026-10-29')).toBe('2026-10-01')
  })
})
