import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import { buildWorkbook, fileName } from './excel'
import type { ReportData } from './types'

const data: ReportData = {
  from: '2026-10-01',
  to: '2026-10-02',
  sales: [{ date: '2026-10-01', cash_amount: 1500, card_amount: 0, note: null }],
  expenses: [
    { id: 1, date: '2026-10-01', category_id: 1, category_name: 'Salary', amount: 200, method: 'cash', note: null },
    { id: 2, date: '2026-10-01', category_id: 2, category_name: 'Room Rent', amount: 200, method: 'bank', note: 'Oct' },
  ],
  recurring: [],
  otherIncome: [],
  credits: [
    { id: 1, party_id: 1, party_name: 'Ali', party_type: 'customer', date: '2026-10-02', kind: 'given', amount: 75, note: null },
  ],
  balances: [
    { id: 1, name: 'Ali', type: 'customer', balance: 75 },
    { id: 2, name: 'Al Ain Foods', type: 'supplier', balance: 1200 },
  ],
}

// Write to bytes and read back, as Excel would see the file
const roundTrip = () => XLSX.read(XLSX.write(buildWorkbook(data), { type: 'buffer', bookType: 'xlsx' }), { cellDates: true })
const rows = (wb: XLSX.WorkBook, name: string) => XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1 })

describe('buildWorkbook', () => {
  it('has the four sheets with matching totals', () => {
    const wb = roundTrip()
    expect(wb.SheetNames).toEqual(['Summary', 'Daily', 'Expenses', 'Credits'])

    const summary = Object.fromEntries(rows(wb, 'Summary').filter((r) => r.length === 2).map((r) => [r[0], r[1]]))
    expect(summary['Total Sale']).toBe(1500)
    expect(summary['Total Expenses']).toBe(400)
    expect(summary['Profit']).toBe(1100)

    const daily = rows(wb, 'Daily')
    expect(daily).toHaveLength(4) // header + 2 days + total
    expect(daily[3]).toEqual(['TOTAL', 1500, 0, 1500, 0, 0, 400, 400, 1100])
    expect((daily[1][0] as Date).getDate()).toBe(1)

    const credits = rows(wb, 'Credits').map((r) => r[0])
    expect(credits).toContain('Total customers owe')
    expect(credits).toContain('Total we owe suppliers')
  })

  it('formats money cells with 2 decimals', () => {
    expect(buildWorkbook(data).Sheets.Daily.B2.z).toBe('#,##0.00')
  })

  it('names the file by date range', () => {
    expect(fileName(data)).toBe('Shop_2026-10-01_to_2026-10-02.xlsx')
  })
})

describe('buildBackupWorkbook', () => {
  it('puts every table on its own sheet, including empty ones', async () => {
    const { buildBackupWorkbook } = await import('./excel')
    const wb = buildBackupWorkbook({ daily_sales: [{ date: '2026-10-01', cash_amount: 5 }], parties: [] })
    expect(wb.SheetNames).toEqual(['daily_sales', 'parties'])
    expect(XLSX.utils.sheet_to_json(wb.Sheets.daily_sales)).toEqual([{ date: '2026-10-01', cash_amount: 5 }])
  })
})
