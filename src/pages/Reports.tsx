import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { summarizeRange } from '../lib/calc'
import { addDays, money, prettyDate, startOfMonth, startOfWeek, todayDubai } from '../lib/format'
import type { ReportData } from '../lib/types'
import { Button, Card, Input, Label } from '../ui'

type Preset = 'week' | 'month' | 'lastMonth' | 'custom'

// Current periods stop at today, so future days don't show fixed costs with no sales
function presetRange(p: Exclude<Preset, 'custom'>): [string, string] {
  const today = todayDubai()
  if (p === 'week') return [startOfWeek(today), today]
  if (p === 'month') return [startOfMonth(today), today]
  const lastDay = addDays(startOfMonth(today), -1)
  return [startOfMonth(lastDay), lastDay]
}

const PRESETS: { id: Preset; label: string }[] = [
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'lastMonth', label: 'Last Month' },
  { id: 'custom', label: 'Custom' },
]

export default function Reports({ onError }: { onError: (e: unknown) => void }) {
  const [preset, setPreset] = useState<Preset>('month')
  const [[from, to], setRange] = useState(() => presetRange('month'))
  const [data, setData] = useState<ReportData | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (!from || !to || from > to) return
    let stale = false
    setData(null)
    api
      .report(from, to)
      .then((d) => !stale && setData(d))
      .catch(onError)
    return () => {
      stale = true
    }
  }, [from, to, onError])

  const summary = useMemo(() => (data ? summarizeRange(data) : null), [data])

  function choose(p: Preset) {
    setPreset(p)
    if (p !== 'custom') setRange(presetRange(p))
  }

  async function download() {
    if (!data) return
    setDownloading(true)
    try {
      // Loaded only when needed: the Excel library is large
      const { downloadExcel } = await import('../lib/excel')
      downloadExcel(data)
    } catch (e) {
      onError(e)
    } finally {
      setDownloading(false)
    }
  }

  const t = summary?.totals

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => choose(p.id)}
            className={`rounded-xl py-3 font-semibold ${
              preset === p.id ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {preset === 'custom' ? (
        <div className="grid grid-cols-2 gap-3">
          <Label text="From">
            <Input type="date" value={from} max={to} onChange={(e) => setRange([e.target.value, to])} />
          </Label>
          <Label text="To">
            <Input type="date" value={to} min={from} onChange={(e) => setRange([from, e.target.value])} />
          </Label>
        </div>
      ) : (
        <p className="text-center text-slate-600">
          {prettyDate(from)} – {prettyDate(to)}
        </p>
      )}

      {!t || !summary ? (
        <p className="py-8 text-center text-slate-500">{from > to ? 'From date must be before To date.' : 'Loading…'}</p>
      ) : (
        <>
          <Button className="w-full" onClick={download} disabled={downloading}>
            {downloading ? 'Preparing…' : '⬇ Download Excel'}
          </Button>

          <Card>
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-semibold">Profit ({summary.days.length} days)</span>
              <span className={`text-2xl font-bold ${t.profit < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                {money(t.profit)}
              </span>
            </div>
          </Card>

          <Card title="Sales">
            <Line label="Cash" value={t.cashSale} />
            <Line label="Card" value={t.cardSale} />
            {t.otherIncome > 0 && <Line label="Other income" value={t.otherIncome} />}
            <Line label="Total" value={t.totalSale + t.otherIncome} bold />
          </Card>

          <Card title="Expenses">
            {summary.byCategory.map((c) => (
              <Line key={c.name} label={c.name} value={c.amount} />
            ))}
            <Line label="Total" value={t.totalExpenses} bold />
          </Card>

          <Card title="Day by day">
            <div className="grid grid-cols-3 border-b border-slate-200 pb-1 text-sm font-medium text-slate-500">
              <span>Date</span>
              <span className="text-right">Sale</span>
              <span className="text-right">Profit</span>
            </div>
            {summary.days.map((d) => (
              <div key={d.date} className="grid grid-cols-3 py-1 text-sm">
                <span>{prettyDate(d.date).replace(/ \d{4}$/, '')}</span>
                <span className="text-right">{money(d.totalSale)}</span>
                <span className={`text-right ${d.profit < 0 ? 'text-red-600' : ''}`}>{money(d.profit)}</span>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  )
}

function Line({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between py-1 ${bold ? 'mt-1 border-t border-slate-200 pt-2 font-semibold' : 'text-slate-700'}`}>
      <span>{label}</span>
      <span>{money(value)}</span>
    </div>
  )
}
