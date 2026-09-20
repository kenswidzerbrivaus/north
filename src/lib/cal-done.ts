import type { CalEvent, Task } from './types'

function linkedTask(event: CalEvent, tasks: readonly Task[]) {
  const gid = event.googleId
  return tasks.find((t) => {
    if (t.eventId && (t.eventId === event.id || (gid && t.eventId === gid))) return true
    if (t.googleId && (t.googleId === event.id || t.googleId === gid || event.id === `gcal:${t.googleId}`)) return true
    return false
  })
}

/** Strike a calendar block only for the task it belongs to, not every same-title item that day. */
export function eventIsDone(event: CalEvent, tasks: readonly Task[]): boolean {
  const linked = linkedTask(event, tasks)
  if (linked) return Boolean(linked.completed)
  const title = event.title.trim().toLowerCase()
  return tasks.some(
    (t) =>
      t.completed &&
      !t.eventId &&
      !t.googleId &&
      t.due === event.date &&
      t.title.trim().toLowerCase() === title,
  )
}
