const aed = new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const money = (n: number) => aed.format(n)

// Today's date in Dubai, as 'YYYY-MM-DD'
export function todayDubai(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(new Date())
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function prettyDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}

export const PERIOD_LABEL = { daily: 'per day', monthly: 'per month', yearly: 'per year' } as const

// Monday of the week containing `date` (UAE weeks run Monday to Sunday)
export function startOfWeek(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay() // 0 = Sunday
  return addDays(date, -((day + 6) % 7))
}

export function startOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`
}
