import { Download, X } from 'lucide-react'
import { useState } from 'react'
import { useInstall } from './lib/install'

const DISMISS_KEY = 'install-banner-dismissed'

function dismissedBefore() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export default function InstallBanner() {
  const { canInstall, install } = useInstall()
  const [hidden, setHidden] = useState(dismissedBefore)
  if (!canInstall || hidden) return null

  function dismiss() {
    setHidden(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // Private mode: banner just comes back next time
    }
  }

  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl bg-slate-900 p-3 text-white shadow-md">
      <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" className="h-10 w-10 rounded-xl" />
      <div className="flex-1">
        <p className="font-semibold">Install Shop app</p>
        <p className="text-xs text-white/70">Open it from your home screen like any app</p>
      </div>
      <button type="button" onClick={install} className="flex items-center gap-1 rounded-xl bg-emerald-500 px-3 py-2 font-semibold">
        <Download size={18} /> Install
      </button>
      <button type="button" onClick={dismiss} aria-label="Not now" className="p-1 text-white/60">
        <X size={18} />
      </button>
    </div>
  )
}
