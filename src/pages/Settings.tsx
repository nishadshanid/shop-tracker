import { useEffect, useState, type FormEvent } from 'react'
import { api, DEMO } from '../lib/api'
import { resetDemo } from '../lib/demoApi'
import { isIOS, useInstall } from '../lib/install'
import { dailyShare } from '../lib/calc'
import { money, PERIOD_LABEL, todayDubai } from '../lib/format'
import type { Category, Mode, Period, RecurringCost } from '../lib/types'
import { AmountInput, Button, Card, Input, Label, Segmented, Select } from '../ui'

const PERIODS: { value: Period; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]
const MODES: { value: Mode; label: string }[] = [
  { value: 'auto', label: 'Add every day' },
  { value: 'manual', label: 'I enter when paid' },
]

type RecurringForm = {
  id?: number
  category_id: number
  amount: string
  period: Period
  mode: Mode
  start_date: string
  end_date: string
  active: number
}

const newRecurring = (): RecurringForm => ({
  category_id: 0, amount: '', period: 'monthly', mode: 'auto', start_date: todayDubai(), end_date: '', active: 1,
})

export default function Settings({ onError, onLogout }: { onError: (e: unknown) => void; onLogout: () => void }) {
  const [categories, setCategories] = useState<Category[]>([])
  const [recurring, setRecurring] = useState<RecurringCost[]>([])
  const [form, setForm] = useState<RecurringForm | null>(null)
  const [newCategory, setNewCategory] = useState('')

  useEffect(() => {
    Promise.all([api.categories(), api.recurring()])
      .then(([cats, rec]) => {
        setCategories(cats)
        setRecurring(rec)
      })
      .catch(onError)
  }, [onError])

  async function saveRecurring(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    try {
      const saved = await api.saveRecurring({ ...form, amount: Number(form.amount), end_date: form.end_date || null })
      setRecurring((rs) => (form.id ? rs.map((r) => (r.id === saved.id ? saved : r)) : [...rs, saved]))
      setForm(null)
    } catch (err) {
      onError(err)
    }
  }

  async function addCategory(e: FormEvent) {
    e.preventDefault()
    try {
      const c = await api.addCategory(newCategory)
      setCategories((cs) => [...cs, c].sort((a, b) => a.name.localeCompare(b.name)))
      setNewCategory('')
    } catch (err) {
      onError(err)
    }
  }

  async function updateCategory(c: Category) {
    try {
      const saved = await api.updateCategory(c)
      setCategories((cs) => cs.map((x) => (x.id === saved.id ? saved : x)))
    } catch (err) {
      onError(err)
    }
  }

  function renameCategory(c: Category) {
    const name = prompt('New name', c.name)?.trim()
    if (name && name !== c.name) updateCategory({ ...c, name })
  }

  const [backingUp, setBackingUp] = useState(false)
  const { canInstall, installed, install } = useInstall()

  async function backup() {
    setBackingUp(true)
    try {
      const [tables, { downloadBackup }] = await Promise.all([api.exportAll(), import('../lib/excel')])
      downloadBackup(tables, todayDubai())
    } catch (err) {
      onError(err)
    } finally {
      setBackingUp(false)
    }
  }

  const autoPerDay = recurring
    .filter((r) => r.active && r.mode === 'auto')
    .reduce((sum, r) => sum + dailyShare(r, todayDubai()), 0)

  return (
    <div className="space-y-4">
      <Card
        title="Fixed costs"
        action={!form && <Button variant="secondary" className="py-2 text-base" onClick={() => setForm(newRecurring())}>+ Add</Button>}
      >
        {form && (
          <form onSubmit={saveRecurring} className="mb-4 space-y-3 rounded-xl bg-slate-50 p-3">
            <Label text="Category">
              <Select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: Number(e.target.value) })}>
                <option value={0}>Choose…</option>
                {categories.filter((c) => c.active).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </Label>
            <Label text="Amount (AED)">
              <AmountInput value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </Label>
            <Segmented value={form.period} options={PERIODS} onChange={(period) => setForm({ ...form, period })} />
            <Segmented value={form.mode} options={MODES} onChange={(mode) => setForm({ ...form, mode })} />
            {form.mode === 'auto' && Number(form.amount) > 0 && (
              <p className="text-sm text-slate-600">
                ≈ {money(dailyShare({ amount: Number(form.amount), period: form.period }, todayDubai()))} added to each day
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Label text="From">
                <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </Label>
              <Label text="Until (optional)">
                <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </Label>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={!!form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked ? 1 : 0 })}
              />
              Active
            </label>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setForm(null)}>Cancel</Button>
              <Button className="flex-1" disabled={!form.category_id || !(Number(form.amount) > 0) || !form.start_date}>
                Save
              </Button>
            </div>
          </form>
        )}

        <ul className="divide-y divide-slate-100">
          {recurring.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className={`flex w-full items-center justify-between py-2 text-left ${r.active ? '' : 'opacity-40'}`}
                onClick={() => setForm({ ...r, amount: String(r.amount), end_date: r.end_date ?? '' })}
              >
                <div>
                  <div className="font-medium">{r.category_name}</div>
                  <div className="text-sm text-slate-500">
                    {r.mode === 'auto' ? 'Added every day' : 'Entered when paid'}
                    {!r.active && ' · off'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{money(r.amount)}</div>
                  <div className="text-sm text-slate-500">{PERIOD_LABEL[r.period]}</div>
                </div>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-2 border-t border-slate-200 pt-2 text-sm text-slate-600">
          Added to each day today: <b>{money(autoPerDay)}</b>
        </p>
      </Card>

      <Card title="Categories">
        <form onSubmit={addCategory} className="mb-3 flex gap-2">
          <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="New category" />
          <Button disabled={!newCategory.trim()}>Add</Button>
        </form>
        <ul className="divide-y divide-slate-100">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center gap-2 py-2">
              <button type="button" className={`flex-1 text-left ${c.active ? '' : 'text-slate-400 line-through'}`} onClick={() => renameCategory(c)}>
                {c.name}
              </button>
              <button
                type="button"
                className="rounded-lg bg-slate-100 px-3 py-1 text-sm"
                onClick={() => updateCategory({ ...c, active: c.active ? 0 : 1 })}
              >
                {c.active ? 'Hide' : 'Show'}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-slate-500">Tap a name to rename it.</p>
      </Card>

      <Card title="App on your phone">
        {installed ? (
          <p className="text-emerald-700">✓ Installed. You are using the app version.</p>
        ) : canInstall ? (
          <Button className="w-full" onClick={install}>⬇ Install Shop app</Button>
        ) : isIOS() ? (
          <p className="text-slate-600">
            In Safari, tap <b>Share</b> (square with arrow) → <b>Add to Home Screen</b>.
          </p>
        ) : (
          <p className="text-slate-600">
            In Chrome, tap <b>⋮</b> (top right) → <b>Install app</b> or <b>Add to Home screen</b>.
          </p>
        )}
      </Card>

      <Card title="Backup">
        <p className="mb-3 text-slate-600">
          Download everything ever entered as one Excel file. Do this once a month and keep the file safe
          (e.g. send it to yourself on WhatsApp or email).
        </p>
        <Button variant="secondary" className="w-full" onClick={backup} disabled={backingUp}>
          {backingUp ? 'Preparing…' : '⬇ Download full backup'}
        </Button>
      </Card>

      {DEMO && (
        <Card title="Demo data">
          <p className="mb-3 text-slate-600">Wipe everything entered on this device and start again with the sample data.</p>
          <Button
            variant="danger"
            className="w-full"
            onClick={() => {
              if (confirm('Delete all demo entries on this device?')) {
                resetDemo()
                location.reload()
              }
            }}
          >
            Reset demo data
          </Button>
        </Card>
      )}

      <Button variant="danger" className="w-full" onClick={onLogout}>Log out</Button>
    </div>
  )
}
