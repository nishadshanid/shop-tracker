export type Period = 'daily' | 'monthly' | 'yearly'
export type Mode = 'auto' | 'manual'
export type Method = 'cash' | 'card' | 'bank'

export interface Category {
  id: number
  name: string
  type: 'expense' | 'income'
  active: number
}

export interface RecurringCost {
  id: number
  category_id: number
  category_name?: string
  amount: number
  period: Period
  mode: Mode
  start_date: string
  end_date: string | null
  active: number
}

export interface Sale {
  date: string
  cash_amount: number
  card_amount: number
  note: string | null
}

export interface Expense {
  id: number
  date: string
  category_id: number
  category_name?: string
  amount: number
  method: Method
  note: string | null
}

export interface OtherIncome {
  id: number
  date: string
  amount: number
  source: string | null
  note: string | null
}

export type CreditKind = 'given' | 'received' | 'bought' | 'paid'

export interface CreditEntry {
  id: number
  party_id: number
  party_name?: string
  party_type?: PartyType
  date: string
  kind: CreditKind
  amount: number
  note: string | null
}

export type PartyType = 'customer' | 'supplier'

export interface PartyBalance {
  id: number
  name: string
  type: PartyType
  phone?: string | null
  balance: number
}

export interface ReportData {
  from: string
  to: string
  sales: Sale[]
  expenses: Expense[]
  recurring: RecurringCost[]
  otherIncome: OtherIncome[]
  credits: CreditEntry[]
  balances: PartyBalance[]
}
