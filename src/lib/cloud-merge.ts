import type { State } from './types'

function recency(item: { updatedAt?: string; createdAt?: string; requestedAt?: string; completedAt?: string }) {
  return Date.parse(item.updatedAt || item.createdAt || item.requestedAt || item.completedAt || '') || 0
}

function mergeById<T extends { id: string }>(
  local: T[] | undefined,
  remote: T[] | undefined,
  score: (item: T) => number = (item) => recency(item as never),
): T[] {
  const map = new Map<string, T>()
  for (const item of local ?? []) map.set(item.id, item)
  for (const item of remote ?? []) {
    const prev = map.get(item.id)
    if (!prev || score(item) >= score(prev)) map.set(item.id, item)
  }
  return [...map.values()]
}

function mergeJournal(local: State['journal'], remote: State['journal']) {
  const map = new Map<string, State['journal'][number]>()
  for (const item of local ?? []) map.set(item.date, item)
  for (const item of remote ?? []) {
    const prev = map.get(item.date)
    if (!prev || recency(item) >= recency(prev)) map.set(item.date, item)
  }
  return [...map.values()]
}

function mergeLogs(local: State['habitLogs'], remote: State['habitLogs']) {
  const map = new Map<string, State['habitLogs'][number]>()
  for (const item of [...(local ?? []), ...(remote ?? [])]) {
    const k = `${item.habitId}|${item.date}`
    const prev = map.get(k)
    if (!prev || item.count >= prev.count) map.set(k, item)
  }
  return [...map.values()]
}

function mergeEvents(local: State['events'], remote: State['events'], localAt: number, remoteAt: number) {
  const map = new Map<string, (typeof local)[number]>()
  const first = localAt >= remoteAt ? remote : local
  const second = localAt >= remoteAt ? local : remote
  for (const e of first ?? []) map.set(e.id, e)
  for (const e of second ?? []) map.set(e.id, e)
  return [...map.values()]
}

/** Keep work from both devices. Newer updatedAt wins when the same id exists on both. */
export function mergeStates(local: State, remote: State): State {
  const localAt = Number(local.savedAt) || 0
  const remoteAt = Number(remote.savedAt) || 0
  const base = remoteAt > localAt ? remote : local
  return {
    ...base,
    version: 1,
    savedAt: Math.max(localAt, remoteAt),
    lists: mergeById(local.lists, remote.lists),
    tasks: mergeById(local.tasks, remote.tasks),
    events: mergeEvents(local.events, remote.events, localAt, remoteAt),
    habits: mergeById(local.habits, remote.habits),
    habitLogs: mergeLogs(local.habitLogs, remote.habitLogs),
    notes: mergeById(local.notes, remote.notes),
    goals: mergeById(local.goals, remote.goals),
    journal: mergeJournal(local.journal, remote.journal),
    sessions: mergeById(local.sessions, remote.sessions),
    projects: mergeById(local.projects, remote.projects),
    milestones: mergeById(local.milestones, remote.milestones),
    workstreams: mergeById(local.workstreams, remote.workstreams),
    projectDecisions: mergeById(local.projectDecisions, remote.projectDecisions),
    blockers: mergeById(local.blockers, remote.blockers),
    waitingOnItems: mergeById(local.waitingOnItems, remote.waitingOnItems),
    projectActivity: mergeById(local.projectActivity, remote.projectActivity),
    goalCycles: mergeById(local.goalCycles, remote.goalCycles),
    goalCheckpoints: mergeById(local.goalCheckpoints, remote.goalCheckpoints),
    goalMovers: mergeById(local.goalMovers, remote.goalMovers),
    goalReviews: mergeById(local.goalReviews, remote.goalReviews),
    envActions: mergeById(local.envActions, remote.envActions),
    northStars: mergeById(local.northStars, remote.northStars),
    settings: {
      ...base.settings,
      googleClientId: local.settings.googleClientId || remote.settings.googleClientId,
    },
  }
}

export function workFingerprint(state: State) {
  return JSON.stringify({
    tasks: state.tasks,
    events: state.events,
    notes: state.notes,
    projects: state.projects,
    milestones: state.milestones,
    goals: state.goals,
    journal: state.journal,
    habits: state.habits,
    habitLogs: state.habitLogs,
    northStars: state.northStars,
  })
}
