import { collapseDuplicateTasks } from './cal-sync'
import type { State } from './types'

function recency(item: { updatedAt?: string; createdAt?: string; requestedAt?: string; completedAt?: string }) {
  return Date.parse(item.updatedAt || item.createdAt || item.requestedAt || item.completedAt || '') || 0
}

function mergeById<T extends { id: string }>(
  local: T[] | undefined,
  remote: T[] | undefined,
  preferLocal: boolean,
  score: (item: T) => number = (item) => recency(item as never),
): T[] {
  const map = new Map<string, T>()
  const first = preferLocal ? remote : local
  const second = preferLocal ? local : remote
  for (const item of first ?? []) map.set(item.id, item)
  for (const item of second ?? []) {
    const prev = map.get(item.id)
    if (!prev || score(item) >= score(prev)) map.set(item.id, item)
  }
  return [...map.values()]
}

function mergeJournal(local: State['journal'], remote: State['journal'], preferLocal: boolean) {
  const map = new Map<string, State['journal'][number]>()
  const first = preferLocal ? remote : local
  const second = preferLocal ? local : remote
  for (const item of first ?? []) map.set(item.date, item)
  for (const item of second ?? []) {
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

function mergeEvents(local: State['events'], remote: State['events'], preferLocal: boolean) {
  const map = new Map<string, (typeof local)[number]>()
  const first = preferLocal ? remote : local
  const second = preferLocal ? local : remote
  for (const e of first ?? []) map.set(e.id, e)
  for (const e of second ?? []) map.set(e.id, e)
  return [...map.values()]
}

/** Keep work from both devices. Goals, notes, and projects included. Newer edit wins. */
export function mergeStates(local: State, remote: State): State {
  const localAt = Number(local.savedAt) || 0
  const remoteAt = Number(remote.savedAt) || 0
  const preferLocal = localAt >= remoteAt
  const base = preferLocal ? local : remote
  return {
    ...base,
    version: 1,
    savedAt: Math.max(localAt, remoteAt),
    lists: mergeById(local.lists, remote.lists, preferLocal),
    tasks: collapseDuplicateTasks(mergeById(local.tasks, remote.tasks, preferLocal)),
    events: mergeEvents(local.events, remote.events, preferLocal),
    habits: mergeById(local.habits, remote.habits, preferLocal),
    habitLogs: mergeLogs(local.habitLogs, remote.habitLogs),
    notes: mergeById(local.notes, remote.notes, preferLocal),
    goals: mergeById(local.goals, remote.goals, preferLocal),
    journal: mergeJournal(local.journal, remote.journal, preferLocal),
    sessions: mergeById(local.sessions, remote.sessions, preferLocal),
    projects: mergeById(local.projects, remote.projects, preferLocal),
    milestones: mergeById(local.milestones, remote.milestones, preferLocal),
    workstreams: mergeById(local.workstreams, remote.workstreams, preferLocal),
    projectDecisions: mergeById(local.projectDecisions, remote.projectDecisions, preferLocal),
    blockers: mergeById(local.blockers, remote.blockers, preferLocal),
    waitingOnItems: mergeById(local.waitingOnItems, remote.waitingOnItems, preferLocal),
    projectActivity: mergeById(local.projectActivity, remote.projectActivity, preferLocal),
    goalCycles: mergeById(local.goalCycles, remote.goalCycles, preferLocal),
    goalCheckpoints: mergeById(local.goalCheckpoints, remote.goalCheckpoints, preferLocal),
    goalMovers: mergeById(local.goalMovers, remote.goalMovers, preferLocal),
    goalReviews: mergeById(local.goalReviews, remote.goalReviews, preferLocal),
    envActions: mergeById(local.envActions, remote.envActions, preferLocal),
    northStars: mergeById(local.northStars, remote.northStars, preferLocal),
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
    workstreams: state.workstreams,
    projectDecisions: state.projectDecisions,
    blockers: state.blockers,
    waitingOnItems: state.waitingOnItems,
    goals: state.goals,
    goalCycles: state.goalCycles,
    goalCheckpoints: state.goalCheckpoints,
    goalMovers: state.goalMovers,
    northStars: state.northStars,
    journal: state.journal,
    habits: state.habits,
    habitLogs: state.habitLogs,
  })
}
