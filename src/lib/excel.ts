import * as XLSX from 'xlsx'
import { summarizeRange } from './calc'
import type { CreditKind, ReportData } from './types'

const MONEY = '#,##0.00'
const DATE = 'dd/mm/yyyy'

const KIND_LABEL: Record<CreditKind, string> = {
  given: 'Gave credit',
  received: 'Received payment',
  bought: 'Bought on credit',
  paid: 'Paid supplier',
}

type Cell = string | number | Date | null
type Row = Cell[]

const round = (n: number) => Math.round(n * 100) / 100

// Local midnight so Excel shows the same calendar day
const toDate = (d: string) => {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day)
}

function sheet(rows: Row[], widths: number[]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(
    rows.map((r) => r.map((c) => (typeof c === 'number' ? round(c) : c))),
    { cellDates: true, dateNF: DATE },
  )
  for (const cell of Object.values(ws)) {
    if (cell && typeof cell === 'object' && 't' in cell) {
      if (cell.t === 'n') cell.z = MONEY
      if (cell.t === 'd') cell.z = DATE
    }
  }
  ws['!cols'] = widths.map((wch) => ({ wch }))
  return ws
}

export function fileName(data: Pick<ReportData, 'from' | 'to'>): string {
  return `Shop_${data.from}_to_${data.to}.xlsx`
}

export function buildWorkbook(data: ReportData): XLSX.WorkBook {
  const { days, totals, byCategory } = summarizeRange(data)
  const wb = XLSX.utils.book_new()

  // 1. Summary: same layout as his paper sheet
  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      [
        ['Shop Report (AED)'],
        ['From', toDate(data.from)],
        ['To', toDate(data.to)],
        ['Days', days.length],
        [],
        ['Description', 'Amount (AED)'],
        ['Cash Sale', totals.cashSale],
        ['Card Sale', totals.cardSale],
        ['Total Sale', totals.totalSale],
        ['Other Income', totals.otherIncome],
        [],
        ['Expenses'],
        ...byCategory.map((c): Row => [c.name, c.amount]),
        ['Total Expenses', totals.totalExpenses],
        [],
        ['Profit', totals.profit],
      ],
      [24, 16],
    ),
    'Summary',
  )
  // "Days" is a count, not money
  wb.Sheets.Summary.B4.z = '0'

  // 2. One row per day
  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      [
        ['Date', 'Cash Sale', 'Card Sale', 'Total Sale', 'Other Income', 'Fixed Costs', 'Other Expenses', 'Total Expenses', 'Profit'],
        ...days.map((d): Row => [
          toDate(d.date), d.cashSale, d.cardSale, d.totalSale, d.otherIncome,
          d.autoTotal, d.enteredTotal, d.totalExpenses, d.profit,
        ]),
        [
          'TOTAL', totals.cashSale, totals.cardSale, totals.totalSale, totals.otherIncome,
          totals.autoTotal, totals.enteredTotal, totals.totalExpenses, totals.profit,
        ],
      ],
      [12, 12, 12, 12, 13, 12, 15, 15, 12],
    ),
    'Daily',
  )

  // 3. Every expense he entered
  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      [
        ['Date', 'Category', 'Amount', 'Method', 'Note'],
        ...data.expenses.map((e): Row => [toDate(e.date), e.category_name ?? '', e.amount, e.method.toUpperCase(), e.note ?? '']),
        ['TOTAL', '', totals.enteredTotal],
        [],
        ['Fixed costs added automatically are in the Daily sheet (Fixed Costs column).'],
      ],
      [12, 22, 12, 9, 30],
    ),
    'Expenses',
  )

  // 4. Credit movements in the period, then balances at the end of it
  const customers = data.balances.filter((b) => b.type === 'customer')
  const suppliers = data.balances.filter((b) => b.type === 'supplier')
  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      [
        ['Date', 'Name', 'Type', 'Entry', 'Amount', 'Note'],
        ...data.credits.map((c): Row => [
          toDate(c.date), c.party_name ?? '', c.party_type === 'supplier' ? 'Supplier' : 'Customer',
          KIND_LABEL[c.kind], c.amount, c.note ?? '',
        ]),
        [],
        ['Balances on', toDate(data.to)],
        ['Customers', 'Owes us'],
        ...customers.map((b): Row => [b.name, b.balance]),
        ['Total customers owe', customers.reduce((s, b) => s + b.balance, 0)],
        [],
        ['Suppliers', 'We owe'],
        ...suppliers.map((b): Row => [b.name, b.balance]),
        ['Total we owe suppliers', suppliers.reduce((s, b) => s + b.balance, 0)],
      ],
      [22, 16, 10, 18, 12, 30],
    ),
    'Credits',
  )

  return wb
}

export function downloadExcel(data: ReportData) {
  XLSX.writeFile(buildWorkbook(data), fileName(data))
}

// Every table as-is, one sheet each, so nothing is lost if the app ever goes away
export function buildBackupWorkbook(tables: Record<string, Record<string, unknown>[]>): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  for (const [name, rows] of Object.entries(tables)) {
    const ws = rows.length ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([['(empty)']])
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31))
  }
  return wb
}

export function downloadBackup(tables: Record<string, Record<string, unknown>[]>, today: string) {
  XLSX.writeFile(buildBackupWorkbook(tables), `Shop_backup_${today}.xlsx`)
}
