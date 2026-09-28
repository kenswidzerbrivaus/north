import { addDays, parseISO, toISO } from './dates'
import type { Habit, HabitLog, State } from './types'

export function habitDupKey(h: Pick<Habit, 'name'>) {
  return h.name.trim().toLowerCase().replace(/\s+/g, ' ')
}

function pickHabitWinner(group: Habit[], logs: HabitLog[]) {
  return [...group].sort((a, b) => {
    if (a.archived !== b.archived) return a.archived ? 1 : -1
    const aLogs = logs.filter((l) => l.habitId === a.id).length
    const bLogs = logs.filter((l) => l.habitId === b.id).length
    if (bLogs !== aLogs) return bLogs - aLogs
    const d = (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)
    if (d) return d
    return b.id.localeCompare(a.id)
  })[0]!
}

/** Same-name daily systems: keep the most used copy and drop the rest. */
export function collapseDuplicateHabits(state: State): State {
  const groups = new Map<string, Habit[]>()
  for (const h of state.habits) {
    const key = habitDupKey(h)
    if (!key) continue
    const rows = groups.get(key) ?? []
    rows.push(h)
    groups.set(key, rows)
  }
  const drop = new Set<string>()
  const remap = new Map<string, string>()
  for (const group of groups.values()) {
    if (group.length < 2) continue
    const winner = pickHabitWinner(group, state.habitLogs)
    for (const h of group) {
      if (h.id === winner.id) continue
      drop.add(h.id)
      remap.set(h.id, winner.id)
    }
  }
  if (!drop.size) return state

  const logKey = new Map<string, HabitLog>()
  for (const l of state.habitLogs) {
    const habitId = remap.get(l.habitId) ?? l.habitId
    if (drop.has(habitId) && !remap.has(l.habitId)) continue
    const k = `${habitId}|${l.date}`
    const prev = logKey.get(k)
    if (!prev || l.count >= prev.count) logKey.set(k, habitId === l.habitId ? l : { ...l, habitId })
  }

  return {
    ...state,
    savedAt: Math.max(Number(state.savedAt) || 0, Date.now()),
    habits: state.habits.filter((h) => !drop.has(h.id)),
    habitLogs: [...logKey.values()],
    goalMovers: state.goalMovers.map((m) =>
      m.entityType === 'habit' && remap.has(m.entityId) ? { ...m, entityId: remap.get(m.entityId)! } : m,
    ),
    envActions: state.envActions.map((a) =>
      a.habitId && remap.has(a.habitId) ? { ...a, habitId: remap.get(a.habitId)! } : a,
    ),
  }
}

export function isHabitDue(habit: Habit, date: Date): boolean {
  if (!habit.days?.length) return true
  return habit.days.includes(date.getDay())
}

export function logCount(logs: HabitLog[], habitId: string, date: string): number {
  return logs.find((l) => l.habitId === habitId && l.date === date)?.count ?? 0
}

export function habitDone(habit: Habit, logs: HabitLog[], date: string): boolean {
  return logCount(logs, habit.id, date) >= habit.target
}

export function habitStreak(habit: Habit, logs: HabitLog[], today: string): number {
  const created = habit.createdAt.slice(0, 10)
  let cursor = parseISO(today)
  if (!habitDone(habit, logs, today)) cursor = addDays(cursor, -1)

  let n = 0
  for (let i = 0; i < 800; i++) {
    const iso = toISO(cursor)
    if (iso < created) break
    if (!isHabitDue(habit, cursor)) {
      cursor = addDays(cursor, -1)
      continue
    }
    if (habitDone(habit, logs, iso)) {
      n += 1
      cursor = addDays(cursor, -1)
    } else break
  }
  return n
}

export function weekRate(habit: Habit, logs: HabitLog[], today: string): { done: number; due: number } {
  const end = parseISO(today)
  let due = 0
  let done = 0
  for (let i = 6; i >= 0; i--) {
    const d = addDays(end, -i)
    if (!isHabitDue(habit, d)) continue
    if (toISO(d) < habit.createdAt.slice(0, 10)) continue
    due += 1
    if (habitDone(habit, logs, toISO(d))) done += 1
  }
  return { done, due }
}
