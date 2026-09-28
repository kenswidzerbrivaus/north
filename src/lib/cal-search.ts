import type { CalEvent } from './types'

function haystack(e: CalEvent) {
  return {
    title: e.title.toLowerCase(),
    loc: (e.location || '').toLowerCase(),
    notes: (e.notes || '').toLowerCase(),
  }
}

function scoreEvent(e: CalEvent, q: string) {
  const { title, loc, notes } = haystack(e)
  if (title === q) return 100
  if (title.startsWith(q)) return 80
  if (title.includes(q)) return 60
  if (loc.includes(q) || notes.includes(q)) return 30
  return 0
}

/** Rank events for the calendar finder. Upcoming title matches first, then past. */
export function matchCalEvents(events: CalEvent[], query: string, today: string): CalEvent[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const seen = new Set<string>()
  const scored: { e: CalEvent; score: number; upcoming: boolean }[] = []
  for (const e of events) {
    const score = scoreEvent(e, q)
    if (!score) continue
    const key = e.googleId || e.id
    if (seen.has(key)) continue
    seen.add(key)
    scored.push({ e, score, upcoming: e.date >= today })
  }
  scored.sort((a, b) => {
    if (a.upcoming !== b.upcoming) return a.upcoming ? -1 : 1
    if (b.score !== a.score) return b.score - a.score
    if (a.e.date !== b.e.date) return a.upcoming ? a.e.date.localeCompare(b.e.date) : b.e.date.localeCompare(a.e.date)
    return (a.e.start || '').localeCompare(b.e.start || '')
  })
  return scored.map((row) => row.e)
}
