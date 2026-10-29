import { X } from 'lucide-react'
import { useEffect } from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'

export function Card({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm">
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between">
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function Label({ text, children }: { text: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-600">{text}</span>
      {children}
    </label>
  )
}

const field =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-lg focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${field} ${props.className ?? ''}`} />
}

// Amount fields open the number keypad on phones
export function AmountInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <Input type="number" inputMode="decimal" step="0.01" min="0" placeholder="0" {...props} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${field} ${props.className ?? ''}`} />
}

type Variant = 'primary' | 'secondary' | 'danger'
const variants: Record<Variant, string> = {
  primary: 'bg-emerald-600 text-white active:bg-emerald-700',
  secondary: 'bg-slate-100 text-slate-800 active:bg-slate-200',
  danger: 'bg-red-50 text-red-700 active:bg-red-100',
}

export function Button({ variant = 'primary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`rounded-xl px-4 py-3 text-lg font-semibold disabled:opacity-50 ${variants[variant]} ${props.className ?? ''}`}
    />
  )
}

// Row of toggle buttons, e.g. Cash / Card / Bank
export function Segmented<T extends string>({
  value, options, onChange,
}: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-lg py-2 font-medium ${
            value === o.value ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function ErrorText({ message }: { message: string | null }) {
  return message ? <p className="rounded-lg bg-red-50 p-2 text-red-700">{message}</p> : null
}

// Panel that slides up from the bottom of the screen, for quick entry forms
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-xl animate-[sheet-up_.2s_ease-out]">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full bg-slate-100 p-2 text-slate-600">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
