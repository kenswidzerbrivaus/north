import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { todayISO } from './lib/dates'
import { nowISO, uid } from './lib/id'
import { depsReady } from './lib/project-engine'
import { readLink } from './lib/google-calendar'
import { matchLinkedTask } from './lib/cal-sync'
import { seedProjectBundle } from './lib/project-seed'
import { rebrandState } from './lib/rebrand'
import type {
  CalEvent,
  CheckpointDay,
  EnvironmentAction,
  FocusSession,
  Goal,
  GoalCheckpoint,
  GoalCycle,
  GoalMover,
  NorthStar,
  GoalReview,
  Habit,
  JournalEntry,
  List,
  Note,
  Project,
  ProjectBlocker,
  ProjectDecision,
  ProjectMilestone,
  Settings,
  State,
  Task,
  WaitingOn,
} from './lib/types'
import { colorFromKey, nextEventColor, nextStarColor, PALETTE } from './lib/types'

const KEY = 'north.v1'

const defaultSettings = (): Settings => ({
  name: '',
  theme: 'system',
  weekStartsOn: 1,
  focusMinutes: 25,
  shortBreak: 5,
  longBreak: 15,
  roundsUntilLong: 4,
  sound: true,
  autoBreaks: true,
  googleClientId: '',
  pushToGoogle: true,
  morningRituals: ['Prayer', 'Self affirmation', 'Read through journal'],
  activeProjectLimit: 10,
  activeGoalLimit: 3,
  travisVoice: true,
  northStar: '',
  northStarHorizon: '',
  northStarMetric: '',
})

export function freshState(): State {
  const created = nowISO()
  const today = todayISO()
  const seed = packSeed(defaultSettings().name || 'Kens')
  const { seedTasks, ...proj } = seed
  return {
    version: 1,
    lists: [
      { id: 'inbox', name: 'Inbox', color: PALETTE[0] },
      { id: 'calendar', name: 'Calendar', color: '#4285f4' },
      { id: 'work', name: 'Work', color: PALETTE[2] },
      { id: 'personal', name: 'Personal', color: PALETTE[1] },
    ],
    tasks: [
      ...seedTasks,
      {
        id: uid(),
        title: 'Walk through Sepho — tasks, calendar, habits, focus',
        notes: 'Open each section from the sidebar. Press ⌘K for the command palette.',
        listId: 'inbox',
        completed: false,
        due: today,
        priority: 2,
        createdAt: created,
        updatedAt: created,
        subtasks: [
          { id: uid(), title: 'Add a task of your own', completed: false },
          { id: uid(), title: 'Check off a habit', completed: false },
        ],
      },
    ],
    events: [],
    habits: [
      {
        id: uid(),
        name: 'Move your body',
        color: PALETTE[1],
        days: [],
        target: 1,
        archived: false,
        createdAt: created,
      },
      {
        id: uid(),
        name: 'Read',
        color: PALETTE[2],
        days: [],
        target: 1,
        archived: false,
        createdAt: created,
      },
      {
        id: uid(),
        name: 'No phone first hour',
        color: PALETTE[4],
        days: [1, 2, 3, 4, 5],
        target: 1,
        archived: false,
        createdAt: created,
      },
    ],
    habitLogs: [],
    notes: [
      {
        id: uid(),
        title: 'Welcome to Sepho',
        body: 'This is your notebook.\n\nCapture ideas, meeting scraps, and weekly reviews. Everything stays on this device — export a backup from Settings when you want a copy.',
        pinned: true,
        createdAt: created,
        updatedAt: created,
      },
    ],
    goals: [
      {
        id: uid(),
        title: 'Build a daily system I actually use',
        notes: 'Keep it small. Show up more than you optimize.',
        progress: 10,
        status: 'active',
        createdAt: created,
      },
    ],
    journal: [],
    sessions: [],
    settings: defaultSettings(),
    goalCycles: [],
    goalCheckpoints: [],
    goalMovers: [],
    goalReviews: [],
    envActions: [],
    northStars: [],
    ...proj,
  }
}

function packSeed(owner: string) {
  const s = seedProjectBundle(owner)
  return {
    projects: s.projects,
    milestones: s.milestones,
    workstreams: s.workstreams,
    projectDecisions: s.decisions,
    blockers: s.blockers,
    waitingOnItems: s.waiting,
    projectActivity: s.activity,
    seedTasks: s.tasks,
  }
}

function blankState(): State {
  return {
    version: 1,
    lists: [
      { id: 'inbox', name: 'Inbox', color: PALETTE[0] },
      { id: 'calendar', name: 'Calendar', color: '#4285f4' },
      { id: 'work', name: 'Work', color: PALETTE[2] },
      { id: 'personal', name: 'Personal', color: PALETTE[1] },
    ],
    tasks: [],
    events: [],
    habits: [],
    habitLogs: [],
    notes: [],
    goals: [],
    journal: [],
    sessions: [],
    settings: defaultSettings(),
    savedAt: 0,
    projects: [],
    milestones: [],
    workstreams: [],
    projectDecisions: [],
    blockers: [],
    waitingOnItems: [],
    projectActivity: [],
    goalCycles: [],
    goalCheckpoints: [],
    goalMovers: [],
    goalReviews: [],
    envActions: [],
    northStars: [],
  }
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return linkExisting(freshState())
    const parsed = JSON.parse(raw) as Partial<State>
    if (!Array.isArray(parsed.lists) || !Array.isArray(parsed.tasks)) return freshState()
    const loaded: State = {
      ...blankState(),
      ...parsed,
      version: 1,
      lists: parsed.lists.length ? parsed.lists : blankState().lists,
      settings: { ...defaultSettings(), ...parsed.settings },
    }
    if (!loaded.settings.googleClientId) {
      const linkedId = readLink()?.clientId
      if (linkedId) loaded.settings.googleClientId = linkedId
    }
    try {
      const gcid = new URLSearchParams(location.hash.split('?')[1] || '').get('gcid')
      if (gcid) loaded.settings.googleClientId = gcid
    } catch {
      /* ignore */
    }
    const needsSeed =
      !Array.isArray(parsed.projects) ||
      (parsed.projects.length === 0 &&
        !(parsed.milestones && parsed.milestones.length) &&
        !(parsed.projectActivity && parsed.projectActivity.length))
    if (!Array.isArray(loaded.northStars)) loaded.northStars = []
    loaded.northStars = loaded.northStars.map((n, i) => {
      if (n.color) return n
      const used = loaded.northStars.slice(0, i).map((x) => x.color).filter(Boolean)
      return { ...n, color: nextStarColor(used) }
    })
    if (!loaded.northStars.length && loaded.settings.northStar?.trim()) {
      const nid = uid()
      loaded.northStars = [
        {
          id: nid,
          title: loaded.settings.northStar.trim(),
          horizon: loaded.settings.northStarHorizon ?? '',
          metric: loaded.settings.northStarMetric ?? '',
          color: nextStarColor([]),
          createdAt: nowISO(),
        },
      ]
      loaded.goalCycles = loaded.goalCycles.map((c) => (c.northStarId ? c : { ...c, northStarId: nid }))
    }
    if (needsSeed) {
      const seed = packSeed(loaded.settings.name || 'Kens')
      const { seedTasks, ...rest } = seed
      Object.assign(loaded, rest)
      if (seedTasks?.length) loaded.tasks = [...seedTasks, ...loaded.tasks]
    }
    return rebrandState(linkExisting(loaded))
  } catch {
    return rebrandState(linkExisting(freshState()))
  }
}

let persistTimer = 0
let pending: State | null = null
let latestState: State | null = null
const persistListeners = new Set<(state: State) => void>()

export function peekState() {
  return pending ?? latestState
}

export function onPersist(fn: (state: State) => void) {
  persistListeners.add(fn)
  return () => persistListeners.delete(fn)
}

export function flushPersist() {
  if (persistTimer) {
    window.clearTimeout(persistTimer)
    persistTimer = 0
  }
  if (!pending) return
  const snap = pending
  pending = null
  try {
    localStorage.setItem(KEY, JSON.stringify(snap))
  } catch {
    /* quota */
  }
  persistListeners.forEach((fn) => fn(snap))
}

function persist(state: State) {
  pending = state
  if (persistTimer) window.clearTimeout(persistTimer)
  persistTimer = window.setTimeout(flushPersist, 250)
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushPersist)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flushPersist()
  })
}

export type Store = {
  state: State
  addList: (name: string, color?: string) => void
  renameList: (id: string, name: string) => void
  deleteList: (id: string) => void
  addTask: (input: Partial<Task> & { title: string }) => string
  updateTask: (id: string, patch: Partial<Task>) => void
  toggleTask: (id: string) => void
  deleteTask: (id: string) => void
  addSubtask: (taskId: string, title: string) => void
  toggleSubtask: (taskId: string, subId: string) => void
  addEvent: (input: Partial<CalEvent> & { title: string; date: string }, opts?: { daily?: boolean }) => string
  updateEvent: (id: string, patch: Partial<CalEvent>) => void
  deleteEvent: (id: string) => void
  syncFromCalendar: (events: CalEvent[]) => void
  dropGoogleItems: (googleId: string) => void
  addHabit: (input: Partial<Habit> & { name: string }) => string
  updateHabit: (id: string, patch: Partial<Habit>) => void
  deleteHabit: (id: string) => void
  setHabitCount: (habitId: string, date: string, count: number) => void
  addNote: (title?: string) => string
  updateNote: (id: string, patch: Partial<Note>) => void
  deleteNote: (id: string) => void
  addGoal: (input: Partial<Goal> & { title: string }, opts?: { overrideCapacity?: boolean }) => string | { error: 'capacity' }
  updateGoal: (id: string, patch: Partial<Goal>) => void
  deleteGoal: (id: string) => void
  addCycle: (input: Partial<GoalCycle> & { name: string; startDate: string; endDate: string; northStarId: string }) => string
  updateCycle: (id: string, patch: Partial<GoalCycle>) => void
  addNorthStar: (input: { title: string; horizon?: string; metric?: string }) => string
  updateNorthStar: (id: string, patch: Partial<NorthStar>) => void
  reorderNorthStars: (ids: string[]) => void
  addCheckpoint: (input: Partial<GoalCheckpoint> & { goalId: string; day: CheckpointDay; targetDescription: string }) => string
  updateCheckpoint: (id: string, patch: Partial<GoalCheckpoint>) => void
  addMover: (input: Omit<GoalMover, 'id'>) => string
  removeMover: (id: string) => void
  setWeeklyMovers: (goalId: string, items: { entityType: GoalMover['entityType']; entityId: string }[]) => void
  addGoalReview: (input: Omit<GoalReview, 'id' | 'createdAt'> & { createdAt?: string }) => string
  addEnvAction: (input: Omit<EnvironmentAction, 'id' | 'done'> & { done?: boolean }) => string
  updateEnvAction: (id: string, patch: Partial<EnvironmentAction>) => void
  upsertJournal: (date: string, patch: Partial<JournalEntry>) => void
  logSession: (session: Omit<FocusSession, 'id'>) => void
  updateSettings: (patch: Partial<Settings>) => void
  importState: (data: unknown) => void
  hydrateFromCloud: (data: State, savedAt: number) => void
  resetState: () => void
  addProject: (input: Partial<Project> & { name: string; owner: string; deadline: string; objective: string; definitionOfDone: string; successMetric: string }, opts?: { overrideCapacity?: boolean }) => string | { error: 'capacity' }
  updateProject: (id: string, patch: Partial<Project>) => void
  addMilestone: (projectId: string, name: string, extra?: Partial<ProjectMilestone>) => string
  addMilestones: (projectId: string, steps: { name: string; plannedEnd?: string; todos?: string[] }[]) => void
  updateMilestone: (id: string, patch: Partial<ProjectMilestone>) => void
  addWorkstream: (projectId: string, name: string, owner: string) => string
  addDecision: (input: Partial<ProjectDecision> & { projectId: string; title: string; owner: string }) => string
  resolveDecision: (id: string, status: ProjectDecision['status'], decision?: string) => void
  addBlocker: (input: Partial<ProjectBlocker> & { projectId: string; title: string; owner: string }) => string
  resolveBlocker: (id: string) => void
  updateBlocker: (id: string, patch: Partial<ProjectBlocker>) => void
  setPrimaryBottleneck: (projectId: string, blockerId: string) => void
  addWaitingOn: (input: Partial<WaitingOn> & { person: string; deliverable: string }) => string
  resolveWaiting: (id: string) => void
  logProject: (projectId: string, type: string, description: string) => void
  completeProject: (id: string, outcome: string, grade: Project['outcomeGrade'], lessons: string) => void
}

function withCalendarList(lists: List[]) {
  if (lists.some((l) => l.id === 'calendar')) return lists
  const inboxAt = lists.findIndex((l) => l.id === 'inbox')
  const cal = { id: 'calendar', name: 'Calendar', color: '#4285f4' }
  if (inboxAt < 0) return [cal, ...lists]
  return [...lists.slice(0, inboxAt + 1), cal, ...lists.slice(inboxAt + 1)]
}

function linkedTask(tasks: Task[], event: CalEvent) {
  return matchLinkedTask(tasks, event)
}

function taskFromEvent(event: CalEvent, existing?: Task): Task {
  const t = nowISO()
  const dueTime = event.allDay ? undefined : event.start
  if (
    existing &&
    existing.title === event.title &&
    existing.due === event.date &&
    existing.dueTime === dueTime &&
    existing.eventId === event.id &&
    existing.googleId === (event.googleId ?? existing.googleId)
  ) {
    return existing
  }
  if (existing) {
    return {
      ...existing,
      title: event.title,
      due: event.date,
      dueTime,
      eventId: event.id,
      googleId: event.googleId ?? existing.googleId,
      notes: existing.notes || event.notes,
      updatedAt: t,
    }
  }
  return {
    id: uid(),
    title: event.title,
    notes: event.notes || '',
    listId: 'calendar',
    completed: false,
    due: event.date,
    dueTime,
    priority: 0,
    createdAt: t,
    updatedAt: t,
    subtasks: [],
    eventId: event.id,
    googleId: event.googleId,
  }
}

function linkExisting(s: State): State {
  let events = s.events
  const tasks = s.tasks.map((t) => {
    if (!t.due || t.eventId) return t
    const eventId = uid()
    events = [
      {
        id: eventId,
        title: t.title,
        notes: t.notes,
        date: t.due,
        start: t.dueTime,
        allDay: !t.dueTime,
        color: colorFromKey(eventId),
        location: '',
      },
      ...events,
    ]
    return { ...t, eventId }
  })
  const used: string[] = []
  events = events.map((e) => {
    if (!used.includes(e.color.toLowerCase())) {
      used.push(e.color.toLowerCase())
      return e
    }
    const color = nextEventColor(used)
    used.push(color.toLowerCase())
    return { ...e, color }
  })
  return pruneGoogleToToday(syncTasksFromEvents({ ...s, events, tasks }))
}

function pruneGoogleToToday(s: State): State {
  const today = todayISO()
  const tasks = s.tasks.filter((t) => !t.googleId || t.completed || t.due === today)
  if (tasks.length === s.tasks.length) return s
  return { ...s, tasks }
}

function syncTasksFromEvents(s: State, extra: CalEvent[] = [], onlyExtra = false): State {
  const events = onlyExtra ? extra : extra.length ? [...s.events, ...extra] : s.events
  const lists = withCalendarList(s.lists)
  let tasks = s.tasks
  let changed = lists !== s.lists
  for (const event of events) {
    const existing = linkedTask(tasks, event)
    const next = taskFromEvent(event, existing)
    if (next === existing) continue
    changed = true
    tasks = existing ? tasks.map((t) => (t.id === existing.id ? next : t)) : [next, ...tasks]
  }
  if (!changed) return s
  return { ...s, lists, tasks }
}

const StoreCtx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(() => load())
  const stateRef = useRef(state)
  stateRef.current = state
  latestState = state

  const patch = useCallback((fn: (s: State) => State, silent = false) => {
    setState((prev) => {
      const next = fn(prev)
      const stamped = silent ? next : { ...next, savedAt: Date.now() }
      latestState = stamped
      persist(stamped)
      return stamped
    })
  }, [])

  const api = useMemo<Omit<Store, 'state'>>(
    () => ({
      addList: (name, color) =>
        patch((s) => ({
          ...s,
          lists: [...s.lists, { id: uid(), name: name.trim() || 'List', color: color ?? PALETTE[s.lists.length % PALETTE.length] }],
        })),
      renameList: (id, name) =>
        patch((s) => ({
          ...s,
          lists: s.lists.map((l) => (l.id === id ? { ...l, name } : l)),
        })),
      deleteList: (id) =>
        patch((s) => {
          if (id === 'inbox' || id === 'calendar') return s
          return {
            ...s,
            lists: s.lists.filter((l) => l.id !== id),
            tasks: s.tasks.map((t) => (t.listId === id ? { ...t, listId: 'inbox' } : t)),
          }
        }),
      addTask: (input) => {
        const id = uid()
        const t = nowISO()
        const eventId = input.eventId ?? (input.due ? uid() : undefined)
        patch((s) => {
          const task: Task = {
            notes: '',
            listId: input.due ? 'calendar' : 'inbox',
            completed: false,
            priority: 0,
            subtasks: [],
            ...input,
            id,
            title: input.title.trim(),
            eventId,
            createdAt: t,
            updatedAt: t,
          }
          let events = s.events
          if (input.due && !input.eventId && eventId) {
            events = [
              {
                id: eventId,
                title: task.title,
                notes: task.notes,
                date: input.due,
                start: input.dueTime,
                allDay: !input.dueTime,
                color: colorFromKey(eventId),
                location: '',
              },
              ...s.events,
            ]
          }
          return { ...s, lists: withCalendarList(s.lists), events, tasks: [task, ...s.tasks] }
        })
        return id
      },
      updateTask: (id, next) =>
        patch((s) => {
          const prev = s.tasks.find((t) => t.id === id)
          if (!prev) return s
          const task: Task = { ...prev, ...next, updatedAt: nowISO() }
          let events = s.events
          if (task.due) {
            if (task.eventId) {
              events = events.map((e) =>
                e.id === task.eventId
                  ? {
                      ...e,
                      title: task.title,
                      date: task.due!,
                      start: task.dueTime,
                      allDay: !task.dueTime,
                      notes: task.notes,
                    }
                  : e,
              )
            } else {
              const eventId = uid()
              task.eventId = eventId
              events = [
                {
                  id: eventId,
                  title: task.title,
                  notes: task.notes,
                  date: task.due,
                  start: task.dueTime,
                  allDay: !task.dueTime,
                  color: colorFromKey(eventId),
                  location: '',
                },
                ...events,
              ]
            }
          }
          return { ...s, events, tasks: s.tasks.map((t) => (t.id === id ? task : t)) }
        }),
      toggleTask: (id) =>
        patch((s) => ({
          ...s,
          tasks: s.tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  completed: !t.completed,
                  completedAt: !t.completed ? nowISO() : undefined,
                  updatedAt: nowISO(),
                }
              : t,
          ),
        })),
      deleteTask: (id) => patch((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) })),
      addSubtask: (taskId, title) =>
        patch((s) => ({
          ...s,
          tasks: s.tasks.map((t) =>
            t.id === taskId
              ? { ...t, subtasks: [...t.subtasks, { id: uid(), title, completed: false }], updatedAt: nowISO() }
              : t,
          ),
        })),
      toggleSubtask: (taskId, subId) =>
        patch((s) => ({
          ...s,
          tasks: s.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  subtasks: t.subtasks.map((st) => (st.id === subId ? { ...st, completed: !st.completed } : st)),
                  updatedAt: nowISO(),
                }
              : t,
          ),
        })),
      addEvent: (input, opts) => {
        const id = uid()
        patch((s) => {
          const event: CalEvent = {
            notes: '',
            allDay: !input.start,
            location: '',
            ...input,
            color: input.color ?? nextEventColor(s.events.map((e) => e.color)),
            id,
            title: input.title.trim(),
          }
          const next = { ...s, events: [event, ...s.events] }
          if (opts?.daily === false) return next
          return syncTasksFromEvents(next)
        })
        return id
      },
      updateEvent: (id, next) =>
        patch((s) => {
          const events = s.events.map((e) => (e.id === id ? { ...e, ...next } : e))
          return syncTasksFromEvents({ ...s, events })
        }),
      deleteEvent: (id) =>
        patch((s) => {
          const event = s.events.find((e) => e.id === id)
          return {
            ...s,
            events: s.events.filter((e) => e.id !== id),
            tasks: s.tasks.filter((t) => {
              if (t.completed) return true
              if (t.eventId === id) return false
              if (event?.googleId && t.googleId === event.googleId && t.due === event.date) return false
              return true
            }),
          }
        }),
      syncFromCalendar: (events) =>
        patch((s) => {
          const today = todayISO()
          let tasks = s.tasks
          let changed = false
          for (const event of events) {
            const existing = linkedTask(tasks, event)
            if (existing) {
              const nextTask = taskFromEvent(event, existing)
              if (nextTask !== existing) {
                changed = true
                tasks = tasks.map((t) => (t.id === existing.id ? nextTask : t))
              }
              continue
            }
            if (event.date !== today) continue
            changed = true
            tasks = [taskFromEvent(event), ...tasks]
          }
          const lists = withCalendarList(s.lists)
          let next: State = changed || lists !== s.lists ? { ...s, lists, tasks } : s
          const pruned = next.tasks.filter((t) => !t.googleId || t.completed || t.due === today)
          if (pruned.length !== next.tasks.length) next = { ...next, tasks: pruned }
          return next
        }, true),
      dropGoogleItems: (googleId) =>
        patch((s) => ({
          ...s,
          events: s.events.filter((e) => e.googleId !== googleId),
          tasks: s.tasks.filter((t) => t.completed || t.googleId !== googleId),
        })),
      addHabit: (input) => {
        const id = uid()
        patch((s) => ({
          ...s,
          habits: [
            {
              color: PALETTE[s.habits.length % PALETTE.length],
              days: [],
              target: 1,
              archived: false,
              ...input,
              id,
              name: input.name.trim(),
              createdAt: nowISO(),
            },
            ...s.habits,
          ],
        }))
        return id
      },
      updateHabit: (id, next) =>
        patch((s) => ({
          ...s,
          habits: s.habits.map((h) => (h.id === id ? { ...h, ...next } : h)),
        })),
      deleteHabit: (id) =>
        patch((s) => ({
          ...s,
          habits: s.habits.filter((h) => h.id !== id),
          habitLogs: s.habitLogs.filter((l) => l.habitId !== id),
        })),
      setHabitCount: (habitId, date, count) =>
        patch((s) => {
          const rest = s.habitLogs.filter((l) => !(l.habitId === habitId && l.date === date))
          return {
            ...s,
            habitLogs: count > 0 ? [...rest, { habitId, date, count }] : rest,
          }
        }),
      addNote: (title = 'Untitled') => {
        const id = uid()
        const t = nowISO()
        patch((s) => ({
          ...s,
          notes: [{ id, title, body: '', pinned: false, createdAt: t, updatedAt: t }, ...s.notes],
        }))
        return id
      },
      updateNote: (id, next) =>
        patch((s) => ({
          ...s,
          notes: s.notes.map((n) => (n.id === id ? { ...n, ...next, updatedAt: nowISO() } : n)),
        })),
      deleteNote: (id) => patch((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id) })),
      addGoal: (input, opts) => {
        const id = uid()
        const status = input.status ?? 'active'
        const current = stateRef.current
        const limit = current.settings.activeGoalLimit ?? 3
        const active = current.goals.filter((g) => g.status === 'active' && (!input.cycleId || g.cycleId === input.cycleId)).length
        if (status === 'active' && active >= limit && !opts?.overrideCapacity) return { error: 'capacity' }
        patch((s) => ({
          ...s,
          goals: [
            { notes: '', progress: 0, status, owner: s.settings.name || 'Kens', ...input, id, title: input.title.trim(), createdAt: nowISO(), updatedAt: nowISO() },
            ...s.goals,
          ],
        }))
        return id
      },
      updateGoal: (id, next) =>
        patch((s) => ({
          ...s,
          goals: s.goals.map((g) => (g.id === id ? { ...g, ...next, updatedAt: nowISO() } : g)),
        })),
      deleteGoal: (id) =>
        patch((s) => ({
          ...s,
          goals: s.goals.filter((g) => g.id !== id),
          goalCheckpoints: s.goalCheckpoints.filter((c) => c.goalId !== id),
          goalMovers: s.goalMovers.filter((m) => m.goalId !== id),
        })),
      addCycle: (input) => {
        const id = uid()
        const starId = input.northStarId
        patch((s) => ({
          ...s,
          goalCycles: [
            { status: 'active', activeGoalLimit: s.settings.activeGoalLimit ?? 3, createdAt: nowISO(), ...input, id, name: input.name.trim(), northStarId: starId },
            ...s.goalCycles.map((c) =>
              c.status === 'active' && c.northStarId === starId ? { ...c, status: 'complete' as const, completedAt: nowISO() } : c,
            ),
          ],
        }))
        return id
      },
      updateCycle: (id, next) =>
        patch((s) => ({
          ...s,
          goalCycles: s.goalCycles.map((c) => (c.id === id ? { ...c, ...next } : c)),
        })),
      addNorthStar: (input) => {
        const id = uid()
        patch((s) => ({
          ...s,
          northStars: [
            {
              id,
              title: input.title.trim(),
              horizon: input.horizon?.trim() ?? '',
              metric: input.metric?.trim() ?? '',
              color: nextStarColor(s.northStars.map((n) => n.color).filter(Boolean)),
              createdAt: nowISO(),
            },
            ...s.northStars,
          ],
          goalCycles: s.northStars.length
            ? s.goalCycles
            : s.goalCycles.map((c) => (c.northStarId ? c : { ...c, northStarId: id })),
        }))
        return id
      },
      updateNorthStar: (id, next) =>
        patch((s) => ({
          ...s,
          northStars: s.northStars.map((n) => (n.id === id ? { ...n, ...next } : n)),
        })),
      reorderNorthStars: (ids) =>
        patch((s) => {
          const map = new Map(s.northStars.map((n) => [n.id, n]))
          const next = ids.map((id) => map.get(id)).filter((n): n is NorthStar => Boolean(n))
          for (const n of s.northStars) if (!ids.includes(n.id)) next.push(n)
          return { ...s, northStars: next }
        }),
      addCheckpoint: (input) => {
        const id = uid()
        patch((s) => ({
          ...s,
          goalCheckpoints: [...s.goalCheckpoints.filter((c) => !(c.goalId === input.goalId && c.day === input.day)), { status: 'upcoming', ...input, id }],
        }))
        return id
      },
      updateCheckpoint: (id, next) =>
        patch((s) => ({
          ...s,
          goalCheckpoints: s.goalCheckpoints.map((c) => (c.id === id ? { ...c, ...next } : c)),
        })),
      addMover: (input) => {
        const id = uid()
        patch((s) => ({
          ...s,
          goalMovers: [...s.goalMovers, { ...input, id }],
        }))
        return id
      },
      removeMover: (id) => patch((s) => ({ ...s, goalMovers: s.goalMovers.filter((m) => m.id !== id) })),
      setWeeklyMovers: (goalId, items) =>
        patch((s) => ({
          ...s,
          goalMovers: [
            ...s.goalMovers.filter((m) => !(m.goalId === goalId && m.weekly)),
            ...items.map((it, i) => ({
              id: uid(),
              goalId,
              rank: i + 1,
              entityType: it.entityType,
              entityId: it.entityId,
              weekly: true,
            })),
          ],
        })),
      addGoalReview: (input) => {
        const id = uid()
        patch((s) => ({
          ...s,
          goalReviews: [{ ...input, id, createdAt: input.createdAt ?? nowISO() }, ...s.goalReviews],
        }))
        return id
      },
      addEnvAction: (input) => {
        const id = uid()
        patch((s) => ({
          ...s,
          envActions: [...s.envActions, { done: false, ...input, id }],
        }))
        return id
      },
      updateEnvAction: (id, next) =>
        patch((s) => ({
          ...s,
          envActions: s.envActions.map((a) => (a.id === id ? { ...a, ...next } : a)),
        })),
      upsertJournal: (date, next) =>
        patch((s) => {
          const existing = s.journal.find((j) => j.date === date)
          if (!existing) {
            return {
              ...s,
              journal: [
                ...s.journal,
                {
                  date,
                  body: '',
                  blessings: ['', '', ''],
                  currentGoals: '',
                  actionsToday: '',
                  actionsTomorrow: '',
                  affirmation: '',
                  shortTermGoal: '',
                  morningWins: ['', '', ''],
                  morningChecks: [false, false, false],
                  updatedAt: nowISO(),
                  ...next,
                },
              ],
            }
          }
          return {
            ...s,
            journal: s.journal.map((j) => (j.date === date ? { ...j, ...next, updatedAt: nowISO() } : j)),
          }
        }),
      logSession: (session) =>
        patch((s) => ({
          ...s,
          sessions: [{ id: uid(), ...session }, ...s.sessions].slice(0, 120),
        })),
      updateSettings: (next) => patch((s) => ({ ...s, settings: { ...s.settings, ...next } })),
      importState: (data) => {
        if (!data || typeof data !== 'object') throw new Error('Invalid backup')
        const d = data as Partial<State>
        if (!Array.isArray(d.lists) || !Array.isArray(d.tasks)) throw new Error('Backup is missing lists or tasks')
        patch(() =>
          rebrandState({
            ...freshState(),
            ...d,
            version: 1,
            settings: { ...defaultSettings(), ...d.settings },
          }),
        )
      },
      hydrateFromCloud: (data, savedAt) => {
        const clientId = stateRef.current.settings.googleClientId
        patch(() => {
          const blank = blankState()
          const next: State = {
            ...blank,
            ...data,
            version: 1,
            savedAt,
            lists: data.lists?.length ? data.lists : blank.lists,
            tasks: data.tasks ?? blank.tasks,
            events: data.events ?? blank.events,
            habits: data.habits ?? blank.habits,
            habitLogs: data.habitLogs ?? blank.habitLogs,
            notes: data.notes ?? blank.notes,
            goals: data.goals ?? blank.goals,
            journal: data.journal ?? blank.journal,
            sessions: data.sessions ?? blank.sessions,
            projects: data.projects ?? blank.projects,
            milestones: data.milestones ?? blank.milestones,
            workstreams: data.workstreams ?? blank.workstreams,
            projectDecisions: data.projectDecisions ?? blank.projectDecisions,
            blockers: data.blockers ?? blank.blockers,
            waitingOnItems: data.waitingOnItems ?? blank.waitingOnItems,
            projectActivity: data.projectActivity ?? blank.projectActivity,
            goalCycles: data.goalCycles ?? blank.goalCycles,
            goalCheckpoints: data.goalCheckpoints ?? blank.goalCheckpoints,
            goalMovers: data.goalMovers ?? blank.goalMovers,
            goalReviews: data.goalReviews ?? blank.goalReviews,
            envActions: data.envActions ?? blank.envActions,
            northStars: data.northStars ?? blank.northStars,
            settings: {
              ...defaultSettings(),
              ...data.settings,
              googleClientId: data.settings?.googleClientId || clientId,
            },
          }
          return rebrandState(linkExisting(next))
        }, true)
      },
      resetState: () => patch(() => freshState()),
      addProject: (input, opts) => {
        const current = stateRef.current
        const activeCount = current.projects.filter((p) => p.state === 'active').length
        const limit = current.settings.activeProjectLimit ?? 10
        const lifecycle = input.state ?? 'active'
        if (lifecycle === 'active' && activeCount >= limit && !opts?.overrideCapacity) {
          return { error: 'capacity' }
        }
        const id = uid()
        patch((s) => {
          const t = nowISO()
          const project: Project = {
            company: '',
            why: '',
            constraints: '',
            problem: '',
            desiredOutcome: '',
            assumptions: '',
            killPivot: '',
            state: lifecycle,
            priority: 2,
            createdAt: t,
            updatedAt: t,
            ...input,
            id,
            name: input.name.trim(),
            owner: input.owner.trim(),
            deadline: input.deadline,
            objective: input.objective.trim(),
            definitionOfDone: input.definitionOfDone.trim(),
            successMetric: input.successMetric.trim(),
          }
          return {
            ...s,
            projects: [project, ...s.projects],
            projectActivity: [
              { id: uid(), projectId: id, type: 'created', description: 'Project created.', createdAt: t },
              ...s.projectActivity,
            ],
          }
        })
        return id
      },
      updateProject: (id, next) =>
        patch((s) => ({
          ...s,
          projects: s.projects.map((p) => (p.id === id ? { ...p, ...next, updatedAt: nowISO() } : p)),
          projectActivity: [
            { id: uid(), projectId: id, type: 'update', description: 'Project updated.', createdAt: nowISO() },
            ...s.projectActivity,
          ],
        })),
      addMilestone: (projectId, name, extra) => {
        const id = uid()
        patch((s) => {
          const order = s.milestones.filter((m) => m.projectId === projectId).length
          const prev = s.milestones.filter((m) => m.projectId === projectId).sort((a, b) => a.sortOrder - b.sortOrder).at(-1)
          return {
            ...s,
            milestones: [
              ...s.milestones,
              {
                id,
                projectId,
                name: name.trim(),
                owner: extra?.owner ?? s.projects.find((p) => p.id === projectId)?.owner ?? '',
                status: extra?.status ?? (order === 0 ? 'current' : 'upcoming'),
                criticalPath: extra?.criticalPath ?? true,
                sortOrder: extra?.sortOrder ?? order,
                notes: extra?.notes ?? '',
                dependsOn: extra?.dependsOn ?? (prev ? [prev.id] : []),
                ...extra,
              },
            ],
            projectActivity: [
              { id: uid(), projectId, type: 'milestone', description: `Milestone added: ${name.trim()}.`, createdAt: nowISO() },
              ...s.projectActivity,
            ],
          }
        })
        return id
      },
      addMilestones: (projectId, steps) => {
        const clean = steps
          .map((n) => ({
            name: n.name.trim(),
            plannedEnd: n.plannedEnd || undefined,
            todos: (n.todos ?? []).map((t) => t.trim()).filter(Boolean),
          }))
          .filter((n) => n.name)
        if (!clean.length) return
        patch((s) => {
          const existing = s.milestones.filter((m) => m.projectId === projectId).sort((a, b) => a.sortOrder - b.sortOrder)
          const owner = s.projects.find((p) => p.id === projectId)?.owner ?? ''
          const listId = s.lists.some((l) => l.id === 'work') ? 'work' : 'inbox'
          const t = nowISO()
          let prevId = existing.at(-1)?.id
          const added = clean.map((step, i) => {
            const id = uid()
            const sortOrder = existing.length + i
            const row: ProjectMilestone = {
              id,
              projectId,
              name: step.name,
              owner,
              plannedEnd: step.plannedEnd,
              status: existing.length === 0 && i === 0 ? 'current' : 'upcoming',
              criticalPath: true,
              sortOrder,
              notes: '',
              dependsOn: prevId ? [prevId] : [],
            }
            prevId = id
            return row
          })
          const todos: Task[] = added.flatMap((row, i) =>
            clean[i]!.todos.map((title) => ({
              id: uid(),
              title,
              notes: '',
              listId,
              completed: false,
              priority: 0,
              createdAt: t,
              updatedAt: t,
              subtasks: [],
              projectId,
              milestoneId: row.id,
            })),
          )
          return {
            ...s,
            milestones: [...s.milestones, ...added],
            tasks: todos.length ? [...todos, ...s.tasks] : s.tasks,
            projectActivity: [
              { id: uid(), projectId, type: 'milestone', description: `Critical path updated (+${added.length}).`, createdAt: nowISO() },
              ...s.projectActivity,
            ],
          }
        })
      },
      updateMilestone: (id, next) =>
        patch((s) => {
          const prev = s.milestones.find((m) => m.id === id)
          let milestones = s.milestones.map((m) => (m.id === id ? { ...m, ...next, updatedAt: nowISO() } : m))
          if (next.status === 'complete' && prev && prev.status !== 'complete') {
            const siblings = milestones.filter((m) => m.projectId === prev.projectId).sort((a, b) => a.sortOrder - b.sortOrder)
            const hasCurrent = siblings.some((m) => m.id !== id && (m.status === 'current' || m.status === 'blocked'))
            if (!hasCurrent) {
              const nxt = siblings.find((m) => m.status !== 'complete' && m.status !== 'blocked' && depsReady(m, siblings))
              if (nxt) milestones = milestones.map((m) => (m.id === nxt.id ? { ...m, status: 'current' as const } : m))
            }
          }
          return {
            ...s,
            milestones,
            projectActivity: prev
              ? [{ id: uid(), projectId: prev.projectId, type: 'milestone', description: `Milestone updated: ${prev.name}.`, createdAt: nowISO() }, ...s.projectActivity]
              : s.projectActivity,
          }
        }),
      addWorkstream: (projectId, name, owner) => {
        const id = uid()
        patch((s) => ({ ...s, workstreams: [...s.workstreams, { id, projectId, name: name.trim(), owner }] }))
        return id
      },
      addDecision: (input) => {
        const id = uid()
        const t = nowISO()
        patch((s) => ({
          ...s,
          projectDecisions: [
            {
              description: '',
              requestedBy: input.owner,
              status: 'pending',
              impactIfDelayed: '',
              context: '',
              ...input,
              id,
              title: input.title.trim(),
              requestedAt: t,
            },
            ...s.projectDecisions,
          ],
          projectActivity: [
            { id: uid(), projectId: input.projectId, type: 'decision', description: `Decision opened: ${input.title.trim()}.`, createdAt: t },
            ...s.projectActivity,
          ],
        }))
        return id
      },
      resolveDecision: (id, status, decision) =>
        patch((s) => {
          const prev = s.projectDecisions.find((d) => d.id === id)
          const closed = status === 'approved' || status === 'rejected' || status === 'resolved' || status === 'delegated'
          return {
            ...s,
            projectDecisions: s.projectDecisions.map((d) =>
              d.id === id ? { ...d, status, decision, decidedAt: closed ? nowISO() : d.decidedAt } : d,
            ),
            projectActivity: prev
              ? [{ id: uid(), projectId: prev.projectId, type: 'decision', description: `Decision ${status}: ${prev.title}.`, createdAt: nowISO() }, ...s.projectActivity]
              : s.projectActivity,
          }
        }),
      addBlocker: (input) => {
        const id = uid()
        const t = nowISO()
        patch((s) => {
          const isPrimary = input.isPrimary ?? !s.blockers.some((b) => b.projectId === input.projectId && !b.resolvedAt && b.isPrimary)
          return {
            ...s,
            blockers: [
              {
                description: '',
                startedAt: t,
                severity: 'high' as const,
                delayDays: 0,
                isPrimary,
                ...input,
                id,
                title: input.title.trim(),
              },
              ...s.blockers.map((b) => (isPrimary && b.projectId === input.projectId ? { ...b, isPrimary: false } : b)),
            ],
            milestones: input.milestoneId
              ? s.milestones.map((m) => (m.id === input.milestoneId && m.status !== 'complete' ? { ...m, status: 'blocked' as const } : m))
              : s.milestones,
            projects: s.projects.map((p) =>
              p.id === input.projectId && isPrimary ? { ...p, primaryBottleneckId: id, updatedAt: t } : p,
            ),
            projectActivity: [
              { id: uid(), projectId: input.projectId, type: 'blocker', description: `Blocker: ${input.title.trim()}.`, createdAt: t },
              ...s.projectActivity,
            ],
          }
        })
        return id
      },
      resolveBlocker: (id) =>
        patch((s) => {
          const prev = s.blockers.find((b) => b.id === id)
          const blockers = s.blockers.map((b) => (b.id === id ? { ...b, resolvedAt: nowISO(), isPrimary: false } : b))
          const stillBlocked = prev?.milestoneId
            ? blockers.some((b) => b.milestoneId === prev.milestoneId && !b.resolvedAt)
            : true
          return {
            ...s,
            blockers,
            milestones:
              prev?.milestoneId && !stillBlocked
                ? s.milestones.map((m) => (m.id === prev.milestoneId && m.status === 'blocked' ? { ...m, status: 'current' as const } : m))
                : s.milestones,
            projects: s.projects.map((p) =>
              prev && p.id === prev.projectId && p.primaryBottleneckId === id ? { ...p, primaryBottleneckId: undefined, updatedAt: nowISO() } : p,
            ),
            projectActivity: prev
              ? [{ id: uid(), projectId: prev.projectId, type: 'blocker', description: `Blocker resolved: ${prev.title}.`, createdAt: nowISO() }, ...s.projectActivity]
              : s.projectActivity,
          }
        }),
      updateBlocker: (id, next) =>
        patch((s) => ({
          ...s,
          blockers: s.blockers.map((b) => (b.id === id ? { ...b, ...next } : b)),
        })),
      setPrimaryBottleneck: (projectId, blockerId) =>
        patch((s) => ({
          ...s,
          blockers: s.blockers.map((b) => (b.projectId === projectId ? { ...b, isPrimary: b.id === blockerId } : b)),
          projects: s.projects.map((p) => (p.id === projectId ? { ...p, primaryBottleneckId: blockerId, updatedAt: nowISO() } : p)),
        })),
      addWaitingOn: (input) => {
        const id = uid()
        const t = nowISO()
        patch((s) => ({
          ...s,
          waitingOnItems: [
            { status: 'open', importance: 'normal', requestedAt: t, ...input, id, person: input.person.trim(), deliverable: input.deliverable.trim() },
            ...s.waitingOnItems,
          ],
          projectActivity: input.projectId
            ? [{ id: uid(), projectId: input.projectId, type: 'waiting', description: `Waiting on ${input.person.trim()}: ${input.deliverable.trim()}.`, createdAt: t }, ...s.projectActivity]
            : s.projectActivity,
        }))
        return id
      },
      resolveWaiting: (id) =>
        patch((s) => {
          const prev = s.waitingOnItems.find((w) => w.id === id)
          return {
            ...s,
            waitingOnItems: s.waitingOnItems.map((w) => (w.id === id ? { ...w, status: 'received' } : w)),
            projectActivity: prev?.projectId
              ? [{ id: uid(), projectId: prev.projectId, type: 'waiting', description: `Received: ${prev.deliverable}.`, createdAt: nowISO() }, ...s.projectActivity]
              : s.projectActivity,
          }
        }),
      logProject: (projectId, type, description) =>
        patch((s) => ({
          ...s,
          projectActivity: [{ id: uid(), projectId, type, description, createdAt: nowISO() }, ...s.projectActivity],
        })),
      completeProject: (id, outcome, grade, lessons) =>
        patch((s) => ({
          ...s,
          projects: s.projects.map((p) =>
            p.id === id
              ? { ...p, state: 'complete', completedAt: nowISO(), outcome, outcomeGrade: grade, lessons, updatedAt: nowISO() }
              : p,
          ),
          projectActivity: [{ id: uid(), projectId: id, type: 'complete', description: `Project closed (${grade}).`, createdAt: nowISO() }, ...s.projectActivity],
        })),
    }),
    [patch],
  )

  const value = useMemo(() => ({ state, ...api }), [state, api])
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore() {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
