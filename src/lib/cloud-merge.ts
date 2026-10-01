import { mergeAttention } from './attention'
import { collapseDuplicateTasks } from './cal-sync'
import { collapseDuplicateRecords } from './project-dupes'
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

function textField(a: string | undefined, b: string | undefined, preferA: boolean) {
  const left = a ?? ''
  const right = b ?? ''
  if (left.trim() && !right.trim()) return left
  if (right.trim() && !left.trim()) return right
  return preferA ? left : right
}

function mergeJournalEntry(
  a: State['journal'][number],
  b: State['journal'][number],
  preferA: boolean,
): State['journal'][number] {
  const newer = preferA ? a : b
  const older = preferA ? b : a
  const blessA = a.blessings ?? ['', '', '']
  const blessB = b.blessings ?? ['', '', '']
  const winsA = a.morningWins ?? ['', '', '']
  const winsB = b.morningWins ?? ['', '', '']
  const chkA = a.morningChecks ?? [false, false, false]
  const chkB = b.morningChecks ?? [false, false, false]
  return {
    ...older,
    ...newer,
    body: textField(a.body, b.body, preferA),
    currentGoals: textField(a.currentGoals, b.currentGoals, preferA),
    actionsToday: textField(a.actionsToday || a.body, b.actionsToday || b.body, preferA),
    actionsTomorrow: textField(a.actionsTomorrow, b.actionsTomorrow, preferA),
    mistakesToday: textField(a.mistakesToday, b.mistakesToday, preferA),
    mistakeReflection: textField(a.mistakeReflection, b.mistakeReflection, preferA),
    affirmation: textField(a.affirmation, b.affirmation, preferA),
    shortTermGoal: textField(a.shortTermGoal, b.shortTermGoal, preferA),
    workout: a.workout || b.workout,
    blessings: [
      textField(blessA[0], blessB[0], preferA),
      textField(blessA[1], blessB[1], preferA),
      textField(blessA[2], blessB[2], preferA),
    ],
    morningWins: [
      textField(winsA[0], winsB[0], preferA),
      textField(winsA[1], winsB[1], preferA),
      textField(winsA[2], winsB[2], preferA),
    ],
    morningChecks: [chkA[0] || chkB[0], chkA[1] || chkB[1], chkA[2] || chkB[2]],
    updatedAt: recency(a) >= recency(b) ? a.updatedAt : b.updatedAt,
  }
}

function mergeJournal(local: State['journal'], remote: State['journal'], preferLocal: boolean) {
  const map = new Map<string, State['journal'][number]>()
  const first = preferLocal ? remote : local
  const second = preferLocal ? local : remote
  for (const item of first ?? []) map.set(item.date, item)
  for (const item of second ?? []) {
    const prev = map.get(item.date)
    if (!prev) map.set(item.date, item)
    else map.set(item.date, mergeJournalEntry(item, prev, recency(item) >= recency(prev)))
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
  return collapseDuplicateRecords({
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
    attention: mergeAttention(local.attention, remote.attention, preferLocal),
    settings: {
      ...(base.settings ?? {}),
      googleClientId: local.settings?.googleClientId || remote.settings?.googleClientId || '',
    },
  })
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
    attention: {
      onboarded: state.attention?.onboarded,
      spaces: state.attention?.spaces,
      activeSpaceId: state.attention?.activeSpaceId,
      locks: state.attention?.locks,
      profiles: state.attention?.profiles,
      activeProfileId: state.attention?.activeProfileId,
      detox: state.attention?.detox,
      quietDays: state.attention?.quietDays,
      appearance: state.attention?.appearance,
      showWeather: state.attention?.showWeather,
      showTime: state.attention?.showTime,
    },
  })
}
