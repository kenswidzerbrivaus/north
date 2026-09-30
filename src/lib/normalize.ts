import { colorFromKey } from './types'
import type { JournalEntry, State } from './types'

function arr<T>(v: T[] | null | undefined): T[] {
  return Array.isArray(v) ? v : []
}

function triple(v: unknown, fill: string): [string, string, string] {
  const a = Array.isArray(v) ? v : []
  return [String(a[0] ?? fill), String(a[1] ?? fill), String(a[2] ?? fill)]
}

function checks(v: unknown): [boolean, boolean, boolean] {
  const a = Array.isArray(v) ? v : []
  return [Boolean(a[0]), Boolean(a[1]), Boolean(a[2])]
}

/** Fill missing arrays/fields so old backups cannot crash the board. */
export function normalizeState(state: State): State {
  return {
    ...state,
    lists: arr(state.lists),
    tasks: arr(state.tasks).map((t) => ({
      ...t,
      title: t.title ?? '',
      notes: t.notes ?? '',
      listId: t.listId || 'inbox',
      subtasks: Array.isArray(t.subtasks) ? t.subtasks : [],
      createdAt: t.createdAt || '',
      updatedAt: t.updatedAt || t.createdAt || '',
    })),
    events: arr(state.events).map((e) => ({
      ...e,
      title: e.title ?? '',
      notes: e.notes ?? '',
      location: e.location ?? '',
      color: e.color || colorFromKey(e.id),
      allDay: Boolean(e.allDay),
    })),
    habits: arr(state.habits).map((h) => ({
      ...h,
      name: h.name ?? '',
      color: h.color || colorFromKey(h.id),
      days: Array.isArray(h.days) ? h.days : [],
      target: h.target || 1,
      createdAt: h.createdAt || '',
    })),
    habitLogs: arr(state.habitLogs),
    notes: arr(state.notes).map((n) => ({
      ...n,
      title: n.title ?? '',
      body: n.body ?? '',
      createdAt: n.createdAt || '',
      updatedAt: n.updatedAt || n.createdAt || '',
    })),
    goals: arr(state.goals),
    journal: arr(state.journal).map(
      (j): JournalEntry => ({
        ...j,
        body: j.body ?? '',
        currentGoals: j.currentGoals ?? '',
        actionsToday: j.actionsToday ?? j.body ?? '',
        actionsTomorrow: j.actionsTomorrow ?? '',
        mistakesToday: j.mistakesToday ?? '',
        mistakeReflection: j.mistakeReflection ?? '',
        affirmation: j.affirmation ?? '',
        shortTermGoal: j.shortTermGoal ?? '',
        blessings: triple(j.blessings, ''),
        morningWins: triple(j.morningWins, ''),
        morningChecks: checks(j.morningChecks),
        updatedAt: j.updatedAt || '',
      }),
    ),
    sessions: arr(state.sessions).map((s) => ({
      ...s,
      startedAt: s.startedAt || s.endedAt || '',
      endedAt: s.endedAt || s.startedAt || '',
    })),
    projects: arr(state.projects),
    milestones: arr(state.milestones).map((m) => ({
      ...m,
      name: m.name ?? '',
      dependsOn: Array.isArray(m.dependsOn) ? m.dependsOn : [],
    })),
    workstreams: arr(state.workstreams),
    projectDecisions: arr(state.projectDecisions),
    blockers: arr(state.blockers),
    waitingOnItems: arr(state.waitingOnItems),
    projectActivity: arr(state.projectActivity),
    goalCycles: arr(state.goalCycles),
    goalCheckpoints: arr(state.goalCheckpoints),
    goalMovers: arr(state.goalMovers),
    goalReviews: arr(state.goalReviews),
    envActions: arr(state.envActions),
    northStars: arr(state.northStars),
  }
}
