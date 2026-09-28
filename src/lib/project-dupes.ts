import { collapseDuplicateTasks } from './cal-sync'
import { collapseDuplicateHabits } from './habits'
import type { Project, State } from './types'

function normName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function projectDupKey(p: Pick<Project, 'name'>) {
  return normName(p.name)
}

function stamp(iso?: string) {
  return Date.parse(iso || '') || 0
}

function freshness(p: Project, state: State) {
  let t = stamp(p.updatedAt) || stamp(p.createdAt)
  for (const m of state.milestones) {
    if (m.projectId !== p.id) continue
    t = Math.max(t, stamp(m.updatedAt), stamp(m.actualEnd), stamp(m.plannedEnd))
  }
  for (const task of state.tasks) {
    if (task.projectId !== p.id) continue
    t = Math.max(t, stamp(task.updatedAt), stamp(task.createdAt), stamp(task.completedAt))
  }
  for (const a of state.projectActivity) {
    if (a.projectId !== p.id) continue
    t = Math.max(t, stamp(a.createdAt))
  }
  return t
}

function workWeight(p: Project, state: State) {
  const ms = state.milestones.filter((m) => m.projectId === p.id).length
  const tasks = state.tasks.filter((t) => t.projectId === p.id).length
  const activity = state.projectActivity.filter((a) => a.projectId === p.id).length
  return ms * 10 + tasks + activity
}

export function pickNewestProject(group: Project[], state: State) {
  return [...group].sort((a, b) => {
    const aWork = workWeight(a, state)
    const bWork = workWeight(b, state)
    if (aWork === 0 && bWork > 0) return 1
    if (bWork === 0 && aWork > 0) return -1
    const d = freshness(b, state) - freshness(a, state)
    if (d) return d
    if (bWork !== aWork) return bWork - aWork
    return b.id.localeCompare(a.id)
  })[0]!
}

/** Same-name projects: keep the most recently worked copy and drop the rest. */
export function collapseDuplicateProjects(state: State): State {
  const groups = new Map<string, Project[]>()
  for (const p of state.projects) {
    const key = projectDupKey(p)
    if (!key) continue
    const rows = groups.get(key) ?? []
    rows.push(p)
    groups.set(key, rows)
  }
  const drop = new Set<string>()
  const remap = new Map<string, string>()
  for (const group of groups.values()) {
    if (group.length < 2) continue
    const winner = pickNewestProject(group, state)
    for (const p of group) {
      if (p.id === winner.id) continue
      drop.add(p.id)
      remap.set(p.id, winner.id)
    }
  }
  if (!drop.size) return state

  const droppedMs = new Set(state.milestones.filter((m) => drop.has(m.projectId)).map((m) => m.id))
  const droppedWs = new Set(state.workstreams.filter((w) => drop.has(w.projectId)).map((w) => w.id))
  const msByName = new Map<string, string>()
  for (const m of state.milestones) {
    if (drop.has(m.projectId)) continue
    msByName.set(`${m.projectId}|${normName(m.name)}`, m.id)
  }
  const msRemap = new Map<string, string>()
  for (const m of state.milestones) {
    if (!drop.has(m.projectId)) continue
    const twin = msByName.get(`${remap.get(m.projectId)}|${normName(m.name)}`)
    if (twin) msRemap.set(m.id, twin)
  }

  const retargetProject = (id?: string) => (id && remap.get(id)) || id
  const retargetMs = (id?: string) => {
    if (!id) return id
    if (msRemap.has(id)) return msRemap.get(id)
    if (droppedMs.has(id)) return undefined
    return id
  }

  const next: State = {
    ...state,
    savedAt: Math.max(Number(state.savedAt) || 0, Date.now()),
    projects: state.projects.filter((p) => !drop.has(p.id)),
    milestones: state.milestones.filter((m) => !drop.has(m.projectId)),
    workstreams: state.workstreams.filter((w) => !drop.has(w.projectId)),
    projectDecisions: state.projectDecisions.filter((d) => !drop.has(d.projectId)),
    blockers: state.blockers.filter((b) => !drop.has(b.projectId)),
    waitingOnItems: state.waitingOnItems.map((w) => {
      const projectId = retargetProject(w.projectId)
      const milestoneId = retargetMs(w.milestoneId)
      if (projectId === w.projectId && milestoneId === w.milestoneId) return w
      return { ...w, projectId, milestoneId }
    }),
    projectActivity: state.projectActivity.filter((a) => !drop.has(a.projectId)),
    tasks: state.tasks.map((t) => {
      const projectId = retargetProject(t.projectId)
      const milestoneId = t.milestoneId ? retargetMs(t.milestoneId) : t.milestoneId
      const workstreamId = t.workstreamId && droppedWs.has(t.workstreamId) ? undefined : t.workstreamId
      if (projectId === t.projectId && milestoneId === t.milestoneId && workstreamId === t.workstreamId) return t
      return { ...t, projectId, milestoneId, workstreamId }
    }),
    notes: state.notes.map((n) => {
      const projectId = retargetProject(n.projectId)
      return projectId === n.projectId ? n : { ...n, projectId }
    }),
    sessions: state.sessions.map((s) => {
      const projectId = retargetProject(s.projectId)
      return projectId === s.projectId ? s : { ...s, projectId }
    }),
    goalMovers: state.goalMovers.map((m) => {
      if (m.entityType !== 'project' || !remap.has(m.entityId)) return m
      return { ...m, entityId: remap.get(m.entityId)! }
    }),
  }
  next.tasks = collapseDuplicateTasks(next.tasks)
  return next
}

export function collapseDuplicateRecords(state: State): State {
  return collapseDuplicateHabits(collapseDuplicateProjects(state))
}
