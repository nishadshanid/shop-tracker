import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import { money, prettyDate, todayDubai } from '../lib/format'
import type { CreditEntry, CreditKind, PartyBalance, PartyType } from '../lib/types'
import { AmountInput, Button, Card, Input, Label, Segmented } from '../ui'

const SIDES: { value: PartyType; label: string }[] = [
  { value: 'customer', label: 'Customers' },
  { value: 'supplier', label: 'Suppliers' },
]

// Wording for each side. "up" entries raise the balance, "down" entries lower it.
const TEXT = {
  customer: {
    one: 'customer', balance: 'Owes you', total: 'Customers owe you',
    up: { kind: 'given' as CreditKind, label: 'Gave credit' },
    down: { kind: 'received' as CreditKind, label: 'Received payment' },
  },
  supplier: {
    one: 'supplier', balance: 'You owe', total: 'You owe suppliers',
    up: { kind: 'bought' as CreditKind, label: 'Bought on credit' },
    down: { kind: 'paid' as CreditKind, label: 'Paid' },
  },
}

const isUp = (k: CreditKind) => k === 'given' || k === 'bought'

export default function Credits({ onError }: { onError: (e: unknown) => void }) {
  const [side, setSide] = useState<PartyType>('customer')
  const [parties, setParties] = useState<PartyBalance[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [search, setSearch] = useState('')

  const reload = useCallback(() => api.parties().then(setParties).catch(onError), [onError])
  useEffect(() => {
    reload()
  }, [reload])

  const t = TEXT[side]
  const list = parties
    .filter((p) => p.type === side)
    .filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()))
  const total = parties.filter((p) => p.type === side).reduce((s, p) => s + p.balance, 0)
  const selected = parties.find((p) => p.id === selectedId)

  async function addParty(e: FormEvent) {
    e.preventDefault()
    try {
      const p = await api.addParty({ name: newName, type: side, phone: newPhone || null })
      setParties((ps) => [...ps, p])
      setAdding(false)
      setNewName('')
      setNewPhone('')
      setSelectedId(p.id)
    } catch (err) {
      onError(err)
    }
  }

  if (selected) {
    return <PartyDetail party={selected} onBack={() => setSelectedId(null)} onChanged={reload} onError={onError} />
  }

  return (
    <div className="space-y-4">
      <Segmented value={side} options={SIDES} onChange={(s) => { setSide(s); setAdding(false); setSearch('') }} />

      <Card>
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-semibold">{t.total}</span>
          <span className={`text-2xl font-bold ${side === 'customer' ? 'text-emerald-700' : 'text-red-600'}`}>
            {money(total)}
          </span>
        </div>
      </Card>

      <Card
        title={side === 'customer' ? 'Customers' : 'Suppliers'}
        action={!adding && <Button variant="secondary" className="py-2 text-base" onClick={() => setAdding(true)}>+ New</Button>}
      >
        {adding && (
          <form onSubmit={addParty} className="mb-4 space-y-3 rounded-xl bg-slate-50 p-3">
            <Input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={`New ${t.one} name`} />
            <Input type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="Phone (optional)" />
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setAdding(false)}>Cancel</Button>
              <Button className="flex-1" disabled={!newName.trim()}>Add</Button>
            </div>
          </form>
        )}
        {parties.filter((p) => p.type === side).length > 5 && (
          <Input className="mb-2" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name" />
        )}
        {list.length === 0 && !adding && <p className="text-slate-500">No {t.one}s yet.</p>}
        <ul className="divide-y divide-slate-100">
          {list.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => setSelectedId(p.id)} className="flex w-full items-center justify-between py-3 text-left">
                <span className="font-medium">{p.name}</span>
                <span className={`font-semibold ${p.balance === 0 ? 'text-slate-400' : ''}`}>{money(p.balance)}</span>
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

function PartyDetail({
  party, onBack, onChanged, onError,
}: { party: PartyBalance; onBack: () => void; onChanged: () => void; onError: (e: unknown) => void }) {
  const t = TEXT[party.type]
  const [entries, setEntries] = useState<CreditEntry[]>([])
  const [kind, setKind] = useState<CreditKind | null>(null)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayDubai)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.partyEntries(party.id).then(setEntries).catch(onError)
  }, [party.id, onError])

  function open(k: CreditKind) {
    setKind(k)
    setAmount('')
    setDate(todayDubai())
    setNote('')
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!kind) return
    setBusy(true)
    try {
      const entry = await api.addCredit({ party_id: party.id, date, kind, amount: Number(amount), note: note || null })
      setEntries((es) => [entry, ...es].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id))
      setKind(null)
      onChanged()
    } catch (err) {
      onError(err)
    } finally {
      setBusy(false)
    }
  }

  async function remove(entry: CreditEntry) {
    if (!confirm(`Delete ${labelFor(entry.kind)} ${money(entry.amount)} on ${prettyDate(entry.date)}?`)) return
    try {
      await api.deleteCredit(entry.id)
      setEntries((es) => es.filter((x) => x.id !== entry.id))
      onChanged()
    } catch (err) {
      onError(err)
    }
  }

  async function edit() {
    const name = prompt('Name', party.name)?.trim()
    if (!name) return
    const phone = prompt('Phone (leave empty for none)', party.phone ?? '')
    try {
      await api.updateParty(party.id, { name, phone: phone?.trim() || null })
      onChanged()
    } catch (err) {
      onError(err)
    }
  }

  const labelFor = (k: CreditKind) => (k === t.up.kind ? t.up.label : t.down.label)

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="text-lg font-medium text-emerald-700">‹ Back</button>

      <Card>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold">{party.name}</h2>
            {party.phone && (
              <a href={`tel:${party.phone}`} className="text-emerald-700">{party.phone}</a>
            )}
          </div>
          <button type="button" onClick={edit} className="rounded-lg bg-slate-100 px-3 py-1 text-sm">Edit</button>
        </div>
        <div className="mt-3 flex items-baseline justify-between border-t border-slate-200 pt-3">
          <span className="text-lg">{t.balance}</span>
          <span className="text-2xl font-bold">{money(party.balance)}</span>
        </div>
      </Card>

      {kind ? (
        <Card title={labelFor(kind)}>
          <form onSubmit={save} className="space-y-3">
            <AmountInput autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" />
            <Label text="Date">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" />
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setKind(null)}>Cancel</Button>
              <Button className="flex-1" disabled={busy || !(Number(amount) > 0) || !date}>Save</Button>
            </div>
          </form>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => open(t.up.kind)}>{t.up.label}</Button>
          <Button variant="secondary" onClick={() => open(t.down.kind)}>{t.down.label}</Button>
        </div>
      )}

      <Card title="History">
        {entries.length === 0 && <p className="text-slate-500">Nothing yet.</p>}
        <ul className="divide-y divide-slate-100">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center gap-2 py-2">
              <div className="flex-1">
                <div className="font-medium">{labelFor(e.kind)}</div>
                <div className="text-sm text-slate-500">
                  {prettyDate(e.date)}
                  {e.note ? ` · ${e.note}` : ''}
                </div>
              </div>
              <span className={`font-semibold ${isUp(e.kind) ? '' : 'text-emerald-700'}`}>
                {isUp(e.kind) ? '+' : '−'}{money(e.amount)}
              </span>
              <button type="button" onClick={() => remove(e)} className="px-2 text-xl text-red-500" aria-label="Delete">×</button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
