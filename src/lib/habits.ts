import { addDays, parseISO, toISO } from './dates'
import type { Habit, HabitLog } from './types'

export function isHabitDue(habit: Habit, date: Date): boolean {
  if (!habit.days.length) return true
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
