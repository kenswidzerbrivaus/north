import type { CalEvent, Task } from './types'

export function matchLinkedTask(tasks: readonly Task[], event: CalEvent) {
  const gid = event.googleId
  return tasks.find((t) => {
    if (t.eventId && t.eventId === event.id) return true
    if (gid && t.eventId === `gcal:${gid}`) return true
    if (gid && t.googleId === gid) return true
    if (t.googleId && event.id === `gcal:${t.googleId}`) return true
    return false
  })
}
