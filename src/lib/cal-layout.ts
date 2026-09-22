import { minutesOf } from './dates'
import type { CalEvent } from './types'

export type LaidBlock = {
  event: CalEvent
  start: number
  end: number
  col: number
  cols: number
}

function span(e: CalEvent) {
  const start = minutesOf(e.start!)
  let end = e.end ? minutesOf(e.end) : start + 60
  if (end <= start) end = start + 60
  return { event: e, start, end }
}

function overlap(a: { start: number; end: number }, b: { start: number; end: number }) {
  return a.start < b.end && b.start < a.end
}

export function layoutTimedEvents(events: CalEvent[]): LaidBlock[] {
  const items = events
    .filter((e) => e.start && !e.allDay)
    .map(span)
    .sort((a, b) => a.start - b.start || a.end - b.end)
  const groups: typeof items[] = []
  for (const item of items) {
    const last = groups[groups.length - 1]
    if (last && last.some((x) => overlap(x, item))) last.push(item)
    else groups.push([item])
  }
  const out: LaidBlock[] = []
  for (const group of groups) {
    const colEnd: number[] = []
    const placed = group.map((item) => {
      let col = colEnd.findIndex((end) => end <= item.start)
      if (col < 0) {
        col = colEnd.length
        colEnd.push(item.end)
      } else colEnd[col] = item.end
      return { ...item, col }
    })
    const cols = Math.max(1, colEnd.length)
    for (const p of placed) out.push({ ...p, cols })
  }
  return out
}

export function minutesToStamp(total: number) {
  const t = Math.max(0, Math.min(24 * 60 - 1, total))
  const h = Math.floor(t / 60)
  const m = t % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export const SNAP_MIN = 5

export function nowMinutes(at = new Date()) {
  return at.getHours() * 60 + at.getMinutes() + at.getSeconds() / 60 + at.getMilliseconds() / 60_000
}

export function nowLineTop(hourPx: number, at = new Date()) {
  return (nowMinutes(at) / 60) * hourPx
}

export function snapStart(pxFromTop: number, hourPx: number, duration: number) {
  const slotPx = hourPx / (60 / SNAP_MIN)
  const raw = Math.round(pxFromTop / slotPx) * SNAP_MIN
  const maxStart = Math.max(0, 24 * 60 - Math.max(SNAP_MIN, duration))
  return Math.max(0, Math.min(maxStart, raw))
}
