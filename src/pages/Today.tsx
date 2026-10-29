import {
  Banknote, Check, ChevronDown, ChevronLeft, ChevronRight, CreditCard, Landmark, PiggyBank, Plus, Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { api } from '../lib/api'
import { summarizeDay, type DaySummary } from '../lib/calc'
import { CategoryBadge } from '../lib/categoryIcon'
import { addDays, money, prettyDate, todayDubai } from '../lib/format'
import type { Category, Expense, Method, OtherIncome, PartyBalance, RecurringCost, Sale } from '../lib/types'
import { Button, Input, Segmented, Sheet } from '../ui'

const METHODS: { value: Method; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bank', label: 'Bank' },
]
const METHOD_ICON = { cash: Banknote, card: CreditCard, bank: Landmark }

type ExpenseForm = { id?: number; category_id: number; amount: string; method: Method; note: string }
const emptyExpense: ExpenseForm = { category_id: 0, amount: '', method: 'cash', note: '' }

export default function Today({ onError, onOpenCredits }: { onError: (e: unknown) => void; onOpenCredits: () => void }) {
  const [date, setDate] = useState(todayDubai)
  const [categories, setCategories] = useState<Category[]>([])
  const [recurring, setRecurring] = useState<RecurringCost[]>([])
  const [parties, setParties] = useState<PartyBalance[]>([])
  const [savedSale, setSavedSale] = useState<Sale | null>(null)
  const [cash, setCash] = useState('')
  const [card, setCard] = useState('')
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [income, setIncome] = useState<OtherIncome[]>([])
  const [expenseSheet, setExpenseSheet] = useState<ExpenseForm | null>(null)
  const [incomeSheet, setIncomeSheet] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loadedDate, setLoadedDate] = useState<string | null>(null)
  const loading = loadedDate !== date
  const isToday = date === todayDubai()

  useEffect(() => {
    Promise.all([api.categories(), api.recurring(), api.parties()])
      .then(([cats, rec, ps]) => {
        setCategories(cats)
        setRecurring(rec)
        setParties(ps)
      })
      .catch(onError)
  }, [onError])

  useEffect(() => {
    setExpenseSheet(null)
    setIncomeSheet(false)
    let stale = false
    api
      .day(date)
      .then(({ sale, expenses, otherIncome }) => {
        // Ignore a slow response for a date he has already moved away from
        if (stale) return
        setSavedSale(sale)
        setCash(sale ? String(sale.cash_amount) : '')
        setCard(sale ? String(sale.card_amount) : '')
        setExpenses(expenses)
        setIncome(otherIncome)
        setLoadedDate(date)
      })
      .catch(onError)
    return () => {
      stale = true
    }
  }, [date, onError])

  const saleDirty =
    Number(cash || 0) !== (savedSale?.cash_amount ?? 0) || Number(card || 0) !== (savedSale?.card_amount ?? 0)

  // Uses what is typed in the sale boxes so the profit updates while typing
  const summary = useMemo(
    () =>
      summarizeDay(
        date,
        { date, cash_amount: Number(cash || 0), card_amount: Number(card || 0), note: null },
        expenses,
        recurring,
        income.reduce((s, i) => s + i.amount, 0),
      ),
    [date, cash, card, expenses, recurring, income],
  )

  const owedToUs = parties.filter((p) => p.type === 'customer').reduce((s, p) => s + p.balance, 0)
  const weOwe = parties.filter((p) => p.type === 'supplier').reduce((s, p) => s + p.balance, 0)

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      onError(e)
    } finally {
      setBusy(false)
    }
  }

  const saveSale = () =>
    run(async () => {
      setSavedSale(await api.saveSale({ date, cash_amount: Number(cash || 0), card_amount: Number(card || 0), note: null }))
    })

  const saveExpense = (form: ExpenseForm) =>
    run(async () => {
      const saved = await api.saveExpense({ ...form, date, amount: Number(form.amount), note: form.note || null })
      const withName = { ...saved, category_name: categories.find((c) => c.id === saved.category_id)?.name }
      setExpenses((xs) => (form.id ? xs.map((x) => (x.id === saved.id ? withName : x)) : [...xs, withName]))
      setExpenseSheet(null)
    })

  const deleteExpense = (expenseId: number) =>
    run(async () => {
      if (!confirm('Delete this expense?')) return
      await api.deleteExpense(expenseId)
      setExpenses((xs) => xs.filter((e) => e.id !== expenseId))
      setExpenseSheet(null)
    })

  const addIncome = (amount: number, source: string) =>
    run(async () => {
      const saved = await api.addIncome({ date, amount, source: source || null, note: null })
      setIncome((xs) => [...xs, saved])
      setIncomeSheet(false)
    })

  const deleteIncome = (x: OtherIncome) =>
    run(async () => {
      if (!confirm(`Delete income ${money(x.amount)}?`)) return
      await api.deleteIncome(x.id)
      setIncome((xs) => xs.filter((i) => i.id !== x.id))
    })

  const closeExpenseSheet = useCallback(() => setExpenseSheet(null), [])
  const closeIncomeSheet = useCallback(() => setIncomeSheet(false), [])

  return (
    <div className="space-y-4">
      {/* Date */}
      <div className="flex items-center gap-2">
        <IconButton label="Previous day" onClick={() => setDate(addDays(date, -1))}>
          <ChevronLeft size={22} />
        </IconButton>
        <label className="relative flex-1 rounded-2xl bg-white py-2 text-center shadow-sm">
          <span className="block font-semibold">{prettyDate(date)}</span>
          <span className={`text-xs font-medium ${isToday ? 'text-emerald-700' : 'text-slate-400'}`}>
            {isToday ? 'Today' : 'Tap to change date'}
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="absolute inset-0 opacity-0"
          />
        </label>
        <IconButton label="Next day" onClick={() => setDate(addDays(date, 1))}>
          <ChevronRight size={22} />
        </IconButton>
      </div>

      <ProfitCard summary={summary} />

      {/* Sale */}
      <Section title="Sale" right={<span className="font-semibold text-slate-900">{money(summary.totalSale)}</span>}>
        <div className="grid grid-cols-2 gap-3">
          <MoneyField label="Cash" icon={<Banknote size={16} />} value={cash} onChange={setCash} disabled={loading} />
          <MoneyField label="Card" icon={<CreditCard size={16} />} value={card} onChange={setCard} disabled={loading} />
        </div>
        {saleDirty ? (
          <Button className="mt-3 w-full" onClick={saveSale} disabled={loading || busy}>
            Save sale
          </Button>
        ) : (
          <p className="mt-3 flex items-center justify-center gap-1 text-sm text-slate-400">
            {loading ? 'Loading…' : savedSale ? <><Check size={16} /> Saved</> : 'Enter the day’s sale above'}
          </p>
        )}
      </Section>

      {/* Expenses */}
      <Section
        title="Expenses"
        right={<span className="font-semibold text-slate-900">{money(summary.enteredTotal)}</span>}
      >
        {expenses.length === 0 && !loading && (
          <p className="pb-2 text-center text-sm text-slate-400">No expenses added for this day</p>
        )}
        <ul className="-mx-1">
          {expenses.map((x) => {
            const MethodIcon = METHOD_ICON[x.method]
            return (
              <li key={x.id}>
                <button
                  type="button"
                  onClick={() =>
                    setExpenseSheet({ id: x.id, category_id: x.category_id, amount: String(x.amount), method: x.method, note: x.note ?? '' })
                  }
                  className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left active:bg-slate-50"
                >
                  <CategoryBadge id={x.category_id} name={x.category_name} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{x.category_name}</span>
                    <span className="flex items-center gap-1 truncate text-sm text-slate-500">
                      <MethodIcon size={14} />
                      {x.method === 'cash' ? 'Cash' : x.method === 'card' ? 'Card' : 'Bank'}
                      {x.note ? ` · ${x.note}` : ''}
                    </span>
                  </span>
                  <span className="font-semibold">{money(x.amount)}</span>
                </button>
              </li>
            )
          })}
        </ul>
        <Button className="mt-2 flex w-full items-center justify-center gap-2" disabled={loading} onClick={() => setExpenseSheet({ ...emptyExpense })}>
          <Plus size={20} /> Add expense
        </Button>
      </Section>

      {/* Other income: money in that is not a sale */}
      <Section
        title="Other income"
        right={summary.otherIncome > 0 ? <span className="font-semibold text-slate-900">{money(summary.otherIncome)}</span> : undefined}
      >
        {income.map((x) => (
          <div key={x.id} className="flex items-center gap-3 py-2">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <PiggyBank size={20} />
            </span>
            <span className="flex-1 font-medium">{x.source || 'Other income'}</span>
            <span className="font-semibold">{money(x.amount)}</span>
            <button type="button" onClick={() => deleteIncome(x)} className="p-1 text-slate-400" aria-label="Delete">
              <Trash2 size={18} />
            </button>
          </div>
        ))}
        <Button variant="secondary" className="mt-1 flex w-full items-center justify-center gap-2" disabled={loading} onClick={() => setIncomeSheet(true)}>
          <Plus size={20} /> Add income
        </Button>
      </Section>

      {/* Credit totals */}
      {parties.length > 0 && (
        <button type="button" onClick={onOpenCredits} className="grid w-full grid-cols-2 gap-3 text-left">
          <MiniStat label="Customers owe you" value={owedToUs} />
          <MiniStat label="You owe suppliers" value={weOwe} />
        </button>
      )}

      {expenseSheet && (
        <ExpenseSheet
          initial={expenseSheet}
          categories={categories.filter((c) => c.active && c.type === 'expense')}
          busy={busy}
          onSave={saveExpense}
          onDelete={deleteExpense}
          onClose={closeExpenseSheet}
        />
      )}
      {incomeSheet && <IncomeSheet busy={busy} onSave={addIncome} onClose={closeIncomeSheet} />}
    </div>
  )
}

function ProfitCard({ summary }: { summary: DaySummary }) {
  const [open, setOpen] = useState(false)
  const loss = summary.profit < 0
  return (
    <section className="rounded-3xl bg-white shadow-sm">
      <div className="p-5">
        <p className={`text-sm font-medium ${loss ? 'text-amber-700' : 'text-slate-500'}`}>
          {loss ? 'Loss for the day' : 'Profit for the day'}
        </p>
        <p className="mt-1 text-4xl font-bold tracking-tight text-slate-900">
          <span className="mr-1 text-lg font-semibold text-slate-400">AED</span>
          {money(Math.abs(summary.profit))}
        </p>
        <div className="mt-4 grid grid-cols-2 divide-x divide-slate-100 rounded-2xl bg-slate-50 py-3">
          <div className="px-4">
            <p className="text-xs text-slate-500">Money in</p>
            <p className="text-lg font-semibold text-slate-800">{money(summary.totalSale + summary.otherIncome)}</p>
          </div>
          <div className="px-4">
            <p className="text-xs text-slate-500">Expenses</p>
            <p className="text-lg font-semibold text-slate-800">{money(summary.totalExpenses)}</p>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-center gap-1 border-t border-slate-100 py-3 text-sm font-medium text-slate-500"
      >
        {open ? 'Hide' : 'Show'} breakdown
        <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-1 border-t border-slate-100 p-4 text-sm text-slate-700">
          <Line label="Cash sale" value={summary.cashSale} />
          <Line label="Card sale" value={summary.cardSale} />
          {summary.otherIncome > 0 && <Line label="Other income" value={summary.otherIncome} />}
          <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Fixed costs (added daily)</p>
          {summary.autoLines.map((l, i) => (
            <Line key={i} label={l.name} value={-l.amount} />
          ))}
          {summary.autoLines.length === 0 && <p className="text-slate-400">None. Add them in Settings.</p>}
          <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Entered today</p>
          <Line label="Expenses" value={-summary.enteredTotal} />
          <div className="mt-2 border-t border-slate-200 pt-2 font-semibold text-slate-900">
            <Line label="Profit" value={summary.profit} />
          </div>
        </div>
      )}
    </section>
  )
}

function ExpenseSheet({
  initial, categories, busy, onSave, onDelete, onClose,
}: {
  initial: ExpenseForm
  categories: Category[]
  busy: boolean
  onSave: (f: ExpenseForm) => void
  onDelete: (id: number) => void
  onClose: () => void
}) {
  const [form, setForm] = useState(initial)
  const amountRef = useRef<HTMLInputElement>(null)

  function pick(id: number) {
    setForm({ ...form, category_id: id })
    // Straight to the amount after picking a category
    amountRef.current?.focus()
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    onSave(form)
  }

  return (
    <Sheet title={form.id ? 'Edit expense' : 'Add expense'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {categories.map((c) => {
            const selected = form.category_id === c.id
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => pick(c.id)}
                className={`flex h-24 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-1 text-center transition ${
                  selected ? 'border-emerald-600 bg-emerald-50' : 'border-transparent bg-slate-50 active:bg-slate-100'
                }`}
              >
                <CategoryBadge id={c.id} name={c.name} />
                <span className={`line-clamp-2 text-xs leading-tight font-medium ${selected ? 'text-emerald-800' : 'text-slate-700'}`}>
                  {c.name}
                </span>
              </button>
            )
          })}
        </div>

        <label className="flex items-baseline gap-2 rounded-2xl bg-slate-50 px-4 py-3 focus-within:ring-2 focus-within:ring-emerald-300">
          <span className="text-lg font-semibold text-slate-400">AED</span>
          <input
            ref={amountRef}
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="w-full bg-transparent text-3xl font-bold outline-none placeholder:text-slate-300"
          />
        </label>

        <Segmented value={form.method} options={METHODS} onChange={(method) => setForm({ ...form, method })} />
        <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Note (optional)" />

        <div className="flex gap-2">
          {form.id && (
            <Button type="button" variant="danger" onClick={() => onDelete(form.id!)} aria-label="Delete" className="px-4">
              <Trash2 size={20} />
            </Button>
          )}
          <Button className="flex-1" disabled={busy || !form.category_id || !(Number(form.amount) > 0)}>
            {!form.category_id ? 'Pick a category' : form.id ? 'Save changes' : 'Add expense'}
          </Button>
        </div>
      </form>
    </Sheet>
  )
}

function IncomeSheet({ busy, onSave, onClose }: { busy: boolean; onSave: (amount: number, source: string) => void; onClose: () => void }) {
  const [amount, setAmount] = useState('')
  const [source, setSource] = useState('')
  return (
    <Sheet title="Add other income" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSave(Number(amount), source)
        }}
        className="space-y-4"
      >
        <p className="text-sm text-slate-500">Money in that is not a sale, e.g. a refund or cash the owner puts in.</p>
        <label className="flex items-baseline gap-2 rounded-2xl bg-slate-50 px-4 py-3 focus-within:ring-2 focus-within:ring-emerald-300">
          <span className="text-lg font-semibold text-slate-400">AED</span>
          <input
            autoFocus
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-transparent text-3xl font-bold outline-none placeholder:text-slate-300"
          />
        </label>
        <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="From / reason (optional)" />
        <Button className="w-full" disabled={busy || !(Number(amount) > 0)}>Add income</Button>
      </form>
    </Sheet>
  )
}

function Section({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  )
}

function MoneyField({
  label, icon, value, onChange, disabled,
}: { label: string; icon: ReactNode; value: string; onChange: (v: string) => void; disabled: boolean }) {
  return (
    <label className="block rounded-2xl bg-slate-50 px-3 py-2 focus-within:ring-2 focus-within:ring-emerald-300">
      <span className="flex items-center gap-1 text-xs font-medium text-slate-500">
        {icon} {label}
      </span>
      <input
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        placeholder="0"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-2xl font-bold outline-none placeholder:text-slate-300 disabled:opacity-50"
      />
    </label>
  )
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-bold text-slate-800">{money(value)}</p>
    </div>
  )
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-14 w-12 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm active:bg-slate-50"
    >
      {children}
    </button>
  )
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span>{money(value)}</span>
    </div>
  )
}
