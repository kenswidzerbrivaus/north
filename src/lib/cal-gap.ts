const KEY = 'north.cal.gap'

export type CalGap = {
  date: string
  start: string
  end?: string
}

export function stashCalGap(gap: CalGap) {
  sessionStorage.setItem(KEY, JSON.stringify(gap))
}

export function takeCalGap(): CalGap | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    sessionStorage.removeItem(KEY)
    return JSON.parse(raw) as CalGap
  } catch {
    return null
  }
}

export function hhmmFromMinutes(total: number) {
  const n = Math.max(0, Math.min(23 * 60 + 55, total))
  const h = Math.floor(n / 60)
  const m = n % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function roundDown5(mins: number) {
  return Math.floor(mins / 5) * 5
}
