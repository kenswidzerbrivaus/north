import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { todayISO } from './lib/dates'
import { nowISO, uid } from './lib/id'
import type {
  CalEvent,
  FocusSession,
  Goal,
  Habit,
  JournalEntry,
  Note,
  Settings,
  State,
  Task,
} from './lib/types'
import { PALETTE } from './lib/types'

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
})

export function freshState(): State {
  const created = nowISO()
  const today = todayISO()
  return {
    version: 1,
    lists: [
      { id: 'inbox', name: 'Inbox', color: PALETTE[0] },
      { id: 'work', name: 'Work', color: PALETTE[2] },
      { id: 'personal', name: 'Personal', color: PALETTE[1] },
    ],
    tasks: [
      {
        id: uid(),
        title: 'Walk through North — tasks, calendar, habits, focus',
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
        title: 'Welcome to North',
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
  }
}

function load(): State {
  const base = freshState()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return base
    const parsed = JSON.parse(raw) as Partial<State>
    return {
      ...base,
      ...parsed,
      version: 1,
      lists: parsed.lists?.length ? parsed.lists : base.lists,
      settings: { ...base.settings, ...parsed.settings },
    }
  } catch {
    return base
  }
}

function persist(state: State) {
  localStorage.setItem(KEY, JSON.stringify(state))
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
  addEvent: (input: Partial<CalEvent> & { title: string; date: string }) => string
  updateEvent: (id: string, patch: Partial<CalEvent>) => void
  deleteEvent: (id: string) => void
  addHabit: (input: Partial<Habit> & { name: string }) => string
  updateHabit: (id: string, patch: Partial<Habit>) => void
  deleteHabit: (id: string) => void
  setHabitCount: (habitId: string, date: string, count: number) => void
  addNote: (title?: string) => string
  updateNote: (id: string, patch: Partial<Note>) => void
  deleteNote: (id: string) => void
  addGoal: (input: Partial<Goal> & { title: string }) => string
  updateGoal: (id: string, patch: Partial<Goal>) => void
  deleteGoal: (id: string) => void
  upsertJournal: (date: string, patch: Partial<JournalEntry>) => void
  logSession: (session: Omit<FocusSession, 'id'>) => void
  updateSettings: (patch: Partial<Settings>) => void
  importState: (data: unknown) => void
  resetState: () => void
}

const StoreCtx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(() => load())

  const patch = useCallback((fn: (s: State) => State) => {
    setState((prev) => {
      const next = fn(prev)
      persist(next)
      return next
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
          if (id === 'inbox') return s
          return {
            ...s,
            lists: s.lists.filter((l) => l.id !== id),
            tasks: s.tasks.map((t) => (t.listId === id ? { ...t, listId: 'inbox' } : t)),
          }
        }),
      addTask: (input) => {
        const id = uid()
        const t = nowISO()
        patch((s) => ({
          ...s,
          tasks: [
            {
              notes: '',
              listId: 'inbox',
              completed: false,
              priority: 0,
              subtasks: [],
              ...input,
              id,
              title: input.title.trim(),
              createdAt: t,
              updatedAt: t,
            },
            ...s.tasks,
          ],
        }))
        return id
      },
      updateTask: (id, next) =>
        patch((s) => ({
          ...s,
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...next, updatedAt: nowISO() } : t)),
        })),
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
      addEvent: (input) => {
        const id = uid()
        patch((s) => ({
          ...s,
          events: [
            {
              notes: '',
              allDay: !input.start,
              color: PALETTE[2],
              location: '',
              ...input,
              id,
              title: input.title.trim(),
            },
            ...s.events,
          ],
        }))
        return id
      },
      updateEvent: (id, next) =>
        patch((s) => ({
          ...s,
          events: s.events.map((e) => (e.id === id ? { ...e, ...next } : e)),
        })),
      deleteEvent: (id) => patch((s) => ({ ...s, events: s.events.filter((e) => e.id !== id) })),
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
      addGoal: (input) => {
        const id = uid()
        patch((s) => ({
          ...s,
          goals: [
            { notes: '', progress: 0, status: 'active', ...input, id, title: input.title.trim(), createdAt: nowISO() },
            ...s.goals,
          ],
        }))
        return id
      },
      updateGoal: (id, next) =>
        patch((s) => ({
          ...s,
          goals: s.goals.map((g) => (g.id === id ? { ...g, ...next } : g)),
        })),
      deleteGoal: (id) => patch((s) => ({ ...s, goals: s.goals.filter((g) => g.id !== id) })),
      upsertJournal: (date, next) =>
        patch((s) => {
          const existing = s.journal.find((j) => j.date === date)
          if (!existing) {
            return { ...s, journal: [...s.journal, { date, body: '', updatedAt: nowISO(), ...next }] }
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
        patch(() => ({
          ...freshState(),
          ...d,
          version: 1,
          settings: { ...defaultSettings(), ...d.settings },
        }))
      },
      resetState: () => patch(() => freshState()),
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
