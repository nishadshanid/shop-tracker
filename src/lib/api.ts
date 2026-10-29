import type {
  Category, CreditEntry, CreditKind, Expense, OtherIncome, PartyBalance, PartyType, RecurringCost, ReportData, Sale,
} from './types'
import { demoApi } from './demoApi'

export class AuthError extends Error {}

async function request<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: init?.json !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: init?.json !== undefined ? JSON.stringify(init.json) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401) throw new AuthError(data.error ?? 'Not logged in')
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`)
  return data as T
}

const serverApi = {
  me: () => request<{ ok: true }>('/me'),
  login: (password: string) => request('/login', { method: 'POST', json: { password } }),
  logout: () => request('/logout', { method: 'POST' }),

  categories: () => request<Category[]>('/categories'),
  addCategory: (name: string) => request<Category>('/categories', { method: 'POST', json: { name } }),
  updateCategory: (c: Category) => request<Category>(`/categories/${c.id}`, { method: 'PUT', json: c }),

  recurring: () => request<RecurringCost[]>('/recurring'),
  saveRecurring: (r: Omit<RecurringCost, 'id'> & { id?: number }) =>
    r.id
      ? request<RecurringCost>(`/recurring/${r.id}`, { method: 'PUT', json: r })
      : request<RecurringCost>('/recurring', { method: 'POST', json: r }),

  exportAll: () => request<Record<string, Record<string, unknown>[]>>('/export'),
  report: (from: string, to: string) => request<ReportData>(`/report?from=${from}&to=${to}`),
  day: (date: string) => request<{ sale: Sale | null; expenses: Expense[]; otherIncome: OtherIncome[] }>(`/day/${date}`),
  saveSale: (s: Sale) => request<Sale>(`/sales/${s.date}`, { method: 'PUT', json: s }),
  saveExpense: (e: Omit<Expense, 'id'> & { id?: number }) =>
    e.id
      ? request<Expense>(`/expenses/${e.id}`, { method: 'PUT', json: e })
      : request<Expense>('/expenses', { method: 'POST', json: e }),
  deleteExpense: (id: number) => request(`/expenses/${id}`, { method: 'DELETE' }),

  addIncome: (i: Omit<OtherIncome, 'id'>) => request<OtherIncome>('/income', { method: 'POST', json: i }),
  deleteIncome: (id: number) => request(`/income/${id}`, { method: 'DELETE' }),

  parties: () => request<PartyBalance[]>('/parties'),
  addParty: (p: { name: string; type: PartyType; phone: string | null }) =>
    request<PartyBalance>('/parties', { method: 'POST', json: p }),
  updateParty: (id: number, p: { name: string; phone: string | null }) =>
    request(`/parties/${id}`, { method: 'PUT', json: p }),
  partyEntries: (id: number) => request<CreditEntry[]>(`/parties/${id}/entries`),
  addCredit: (e: { party_id: number; date: string; kind: CreditKind; amount: number; note: string | null }) =>
    request<CreditEntry>('/credits', { method: 'POST', json: e }),
  deleteCredit: (id: number) => request(`/credits/${id}`, { method: 'DELETE' }),
}

export type Api = typeof serverApi

// Demo build (GitHub Pages): data lives in this browser only, no server
export const DEMO = import.meta.env.VITE_DEMO === 'true'
export const api: Api = DEMO ? demoApi : serverApi
