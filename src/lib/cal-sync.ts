import type { CalEvent, Task } from './types'

function normTitle(s: string) {
  return s.trim().toLowerCase()
}

function recency(t: Task) {
  return Date.parse(t.updatedAt || t.createdAt || '') || 0
}

function idsMatch(task: Task, event: CalEvent) {
  const gid = event.googleId
  if (task.eventId && task.eventId === event.id) return true
  if (gid && task.eventId === `gcal:${gid}`) return true
  if (gid && task.eventId?.startsWith(`gcal:${gid}:`)) return true
  if (gid && task.googleId === gid) return true
  if (task.googleId && event.id === `gcal:${task.googleId}`) return true
  if (task.googleId && event.id.startsWith(`gcal:${task.googleId}:`)) return true
  return false
}

export function matchLinkedTask(tasks: readonly Task[], event: CalEvent) {
  const hit = tasks.find((t) => idsMatch(t, event))
  if (hit) return hit
  const title = normTitle(event.title)
  const twins = tasks.filter((t) => normTitle(t.title) === title && (t.due || '') === event.date)
  if (!twins.length) return undefined
  const unlinked = twins.filter((t) => !t.googleId && !t.eventId)
  if (unlinked.length === 1) return unlinked[0]
  if (twins.length === 1) return twins[0]
  return undefined
}

function pickTask(a: Task, b: Task): Task {
  const winner = recency(a) >= recency(b) ? a : b
  const loser = winner === a ? b : a
  return {
    ...winner,
    completed: a.completed || b.completed,
    completedAt: a.completedAt || b.completedAt,
    notes: winner.notes || loser.notes,
    eventId: winner.eventId || loser.eventId,
    googleId: winner.googleId || loser.googleId,
    blocked: Boolean(winner.blocked || loser.blocked),
    updatedAt: recency(a) >= recency(b) ? a.updatedAt : b.updatedAt,
  }
}

/** Drop cloned tasks that point at the same event or the same Google item. */
export function collapseDuplicateTasks(tasks: Task[]): Task[] {
  if (tasks.length < 2) return tasks
  const parent = new Map<string, string>()
  const items = new Map<string, Task>()
  for (const t of tasks) {
    parent.set(t.id, t.id)
    items.set(t.id, t)
  }
  const find = (id: string): string => {
    const p = parent.get(id)!
    if (p !== id) {
      const root = find(p)
      parent.set(id, root)
      return root
    }
    return p
  }
  const union = (a: string, b: string) => {
    const pa = find(a)
    const pb = find(b)
    if (pa === pb) return
    parent.set(pb, pa)
    items.set(pa, pickTask(items.get(pa)!, items.get(pb)!))
  }

  const byEvent = new Map<string, string>()
  const byGoogle = new Map<string, string>()
  for (const t of tasks) {
    if (t.eventId) {
      const prev = byEvent.get(t.eventId)
      if (prev) union(prev, t.id)
      else byEvent.set(t.eventId, t.id)
    }
    if (t.googleId) {
      const prev = byGoogle.get(t.googleId)
      if (prev) union(prev, t.id)
      else byGoogle.set(t.googleId, t.id)
    }
  }

  const byTitleDue = new Map<string, Task[]>()
  for (const t of tasks) {
    if (!t.due) continue
    const k = `${normTitle(t.title)}|${t.due}`
    const arr = byTitleDue.get(k) ?? []
    arr.push(t)
    byTitleDue.set(k, arr)
  }
  for (const group of byTitleDue.values()) {
    if (group.length < 2) continue
    const linked = group.filter((t) => t.googleId || t.eventId)
    const unlinked = group.filter((t) => !t.googleId && !t.eventId)
    if (linked.length && unlinked.length) {
      for (const u of unlinked) union(linked[0]!.id, u.id)
    }
  }

  const seen = new Set<string>()
  const out: Task[] = []
  for (const t of tasks) {
    const root = find(t.id)
    if (seen.has(root)) continue
    seen.add(root)
    out.push(items.get(root)!)
  }
  return out
}
