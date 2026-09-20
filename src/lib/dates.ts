export function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayISO(): string {
  return toISO(new Date())
}

export function parseDeadline(raw: string): string {
  const s = raw.trim()
  if (!s) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const mdY = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/)
  if (mdY) {
    const month = Number(mdY[1])
    const day = Number(mdY[2])
    const year = Number(mdY[3]!.length === 2 ? `20${mdY[3]}` : mdY[3])
    const d = new Date(year, month - 1, day)
    if (!Number.isNaN(d.getTime()) && d.getMonth() === month - 1 && d.getDate() === day) return toISO(d)
  }
  const parsed = new Date(s)
  if (!Number.isNaN(parsed.getTime())) return toISO(parsed)
  return ''
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() + n)
  return x
}

export function startOfWeek(d: Date, weekStartsOn: 0 | 1): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = x.getDay()
  const diff = weekStartsOn === 1 ? (day === 0 ? 6 : day - 1) : day
  x.setDate(x.getDate() - diff)
  return x
}

export function weekdayNames(weekStartsOn: 0 | 1): string[] {
  const sun = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return weekStartsOn === 1 ? [...sun.slice(1), 'Sun'] : sun
}

export function monthName(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export function formatLong(iso: string): string {
  return parseISO(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

export function formatMedium(iso: string): string {
  return parseISO(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function formatShort(iso: string): string {
  return parseISO(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const hour = h ?? 0
  const am = hour < 12
  const hr = hour % 12 || 12
  return `${hr}:${String(m ?? 0).padStart(2, '0')} ${am ? 'AM' : 'PM'}`
}

export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

/** HH:mm for time inputs. Strips seconds iPhone type=time sometimes appends. */
export function stampTime(raw?: string): string | undefined {
  if (!raw) return undefined
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})/)
  if (!m) return undefined
  return `${String(Number(m[1])).padStart(2, '0')}:${m[2]}`
}

export function greeting(name: string): string {
  const h = new Date().getHours()
  const who = name.trim() ? `, ${name.trim()}` : ''
  if (h < 5) return `Still going${who}`
  if (h < 12) return `Good morning${who}`
  if (h < 17) return `Good afternoon${who}`
  if (h < 21) return `Good evening${who}`
  return `Winding down${who}`
}

export function monthCells(
  year: number,
  month: number,
  weekStartsOn: 0 | 1,
): { date: Date; iso: string; inMonth: boolean }[] {
  const first = new Date(year, month, 1)
  const start = startOfWeek(first, weekStartsOn)
  return Array.from({ length: 42 }, (_, i) => {
    const date = addDays(start, i)
    return {
      date,
      iso: toISO(date),
      inMonth: date.getMonth() === month,
    }
  })
}

export function sameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}
