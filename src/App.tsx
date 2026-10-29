import { CalendarDays, FileSpreadsheet, HandCoins, Settings as SettingsIcon, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import InstallBanner from './InstallBanner'
import { api, AuthError, DEMO } from './lib/api'
import Credits from './pages/Credits'
import Login from './pages/Login'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Today from './pages/Today'

type Tab = 'today' | 'credits' | 'reports' | 'settings'
const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'today', label: 'Today', icon: CalendarDays },
  { id: 'credits', label: 'Credits', icon: HandCoins },
  { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
]

export default function App() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [tab, setTab] = useState<Tab>('today')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.me().then(() => setLoggedIn(true)).catch(() => setLoggedIn(false))
  }, [])

  const onError = useCallback((e: unknown) => {
    if (e instanceof AuthError) setLoggedIn(false)
    else setError((e as Error).message)
  }, [])

  async function logout() {
    await api.logout().catch(() => {})
    setLoggedIn(false)
  }

  if (loggedIn === null) return null
  if (!loggedIn) return <Login onLogin={() => setLoggedIn(true)} />

  return (
    <div className="min-h-screen bg-slate-100 pb-24 text-slate-900">
      <main className="mx-auto max-w-lg p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
        {DEMO && (
          <p className="mb-3 rounded-xl bg-amber-100 px-3 py-2 text-center text-sm font-medium text-amber-900">
            Demo version: entries are saved on this device only
          </p>
        )}
        <InstallBanner />
        {error && (
          <button type="button" onClick={() => setError(null)} className="mb-4 w-full rounded-xl bg-red-50 p-3 text-left text-red-700">
            {error} <span className="float-right">×</span>
          </button>
        )}
        {tab === 'today' && <Today onError={onError} onOpenCredits={() => setTab('credits')} />}
        {tab === 'credits' && <Credits onError={onError} />}
        {tab === 'reports' && <Reports onError={onError} />}
        {tab === 'settings' && <Settings onError={onError} onLogout={logout} />}
      </main>
      <nav className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-lg">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id)
                window.scrollTo({ top: 0 })
              }}
              className={`flex flex-1 flex-col items-center gap-0.5 pt-2 pb-2 text-xs font-semibold ${
                tab === t.id ? 'text-emerald-700' : 'text-slate-400'
              }`}
            >
              <span className={`rounded-full px-4 py-1 ${tab === t.id ? 'bg-emerald-100' : ''}`}>
                <t.icon size={22} strokeWidth={tab === t.id ? 2.4 : 2} />
              </span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
