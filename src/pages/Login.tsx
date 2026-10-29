import { useState, type FormEvent } from 'react'
import { api, DEMO } from '../lib/api'
import { Button, ErrorText, Input, Label } from '../ui'

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.login(password)
      onLogin()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-bold">Shop Tracker</h1>
        <Label text="Password">
          <Input type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
        </Label>
        {DEMO && <p className="text-sm text-amber-700">Demo version: type any password.</p>}
        <ErrorText message={error} />
        <Button className="w-full" disabled={busy || !password}>
          {busy ? 'Checking…' : 'Log in'}
        </Button>
      </form>
    </main>
  )
}
