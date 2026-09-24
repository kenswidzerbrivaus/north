import { matchLinkedTask } from './cal-sync'
import type { CalEvent, Task } from './types'

/** Strike a calendar block only for the task it belongs to, not every same-title item that day. */
export function eventIsDone(event: CalEvent, tasks: readonly Task[], dayEvents: readonly CalEvent[] = []): boolean {
  const linked = matchLinkedTask(tasks, event)
  if (linked) return Boolean(linked.completed)
  const title = event.title.trim().toLowerCase()
  const sameName = dayEvents.filter((e) => e.date === event.date && e.title.trim().toLowerCase() === title)
  if (sameName.length > 1) return false
  return tasks.some(
    (t) =>
      t.completed &&
      !t.eventId &&
      !t.googleId &&
      t.due === event.date &&
      t.title.trim().toLowerCase() === title,
  )
}
