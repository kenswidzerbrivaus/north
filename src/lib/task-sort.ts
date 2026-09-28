type SortableTask = {
  id?: string
  title: string
  due?: string
  dueTime?: string
  createdAt: string
  completed?: boolean
  completedAt?: string
  updatedAt?: string
}

function stampTime(raw?: string) {
  if (!raw) return '00:00'
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})/)
  if (!m) return '00:00'
  return `${String(Number(m[1])).padStart(2, '0')}:${m[2]}`
}

/** Earliest due date/time first. Undated sit after dated. Done lists follow completedAt. */
export function sortTasksChronological<T extends SortableTask>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    if (a.completed && b.completed) {
      const ac = a.completedAt || a.updatedAt || a.createdAt
      const bc = b.completedAt || b.updatedAt || b.createdAt
      const d = ac.localeCompare(bc)
      if (d) return d
    }
    const aDue = a.due || ''
    const bDue = b.due || ''
    if (aDue !== bDue) {
      if (!aDue) return 1
      if (!bDue) return -1
      return aDue.localeCompare(bDue)
    }
    if (aDue) {
      const at = stampTime(a.dueTime)
      const bt = stampTime(b.dueTime)
      if (at !== bt) return at.localeCompare(bt)
    } else {
      const d = a.createdAt.localeCompare(b.createdAt)
      if (d) return d
    }
    const names = a.title.localeCompare(b.title)
    if (names) return names
    return (a.id || '').localeCompare(b.id || '')
  })
}
