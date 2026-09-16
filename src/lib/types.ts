export type Priority = 0 | 1 | 2 | 3
export type ThemeMode = 'light' | 'dark' | 'system'
export type Route =
  | 'today'
  | 'tasks'
  | 'calendar'
  | 'habits'
  | 'focus'
  | 'notes'
  | 'goals'
  | 'journal'
  | 'settings'

export type TimerMode = 'focus' | 'short' | 'long'

export interface Subtask {
  id: string
  title: string
  completed: boolean
}

export interface List {
  id: string
  name: string
  color: string
}

export interface Task {
  id: string
  title: string
  notes: string
  listId: string
  completed: boolean
  completedAt?: string
  due?: string
  dueTime?: string
  priority: Priority
  createdAt: string
  updatedAt: string
  subtasks: Subtask[]
  eventId?: string
  googleId?: string
}

export interface CalEvent {
  id: string
  title: string
  notes: string
  date: string
  start?: string
  end?: string
  allDay: boolean
  color: string
  location: string
  googleId?: string
}

export interface Habit {
  id: string
  name: string
  color: string
  days: number[]
  target: number
  archived: boolean
  createdAt: string
}

export interface HabitLog {
  habitId: string
  date: string
  count: number
}

export interface Note {
  id: string
  title: string
  body: string
  pinned: boolean
  createdAt: string
  updatedAt: string
}

export interface Goal {
  id: string
  title: string
  notes: string
  targetDate?: string
  progress: number
  status: 'active' | 'paused' | 'done'
  createdAt: string
}

export interface JournalEntry {
  date: string
  mood?: 1 | 2 | 3 | 4 | 5
  body: string
  updatedAt: string
}

export interface FocusSession {
  id: string
  mode: TimerMode
  seconds: number
  startedAt: string
  endedAt: string
  taskId?: string
  completed: boolean
}

export interface Settings {
  name: string
  theme: ThemeMode
  weekStartsOn: 0 | 1
  focusMinutes: number
  shortBreak: number
  longBreak: number
  roundsUntilLong: number
  sound: boolean
  autoBreaks: boolean
  googleClientId: string
  pushToGoogle: boolean
}

export interface State {
  version: 1
  lists: List[]
  tasks: Task[]
  events: CalEvent[]
  habits: Habit[]
  habitLogs: HabitLog[]
  notes: Note[]
  goals: Goal[]
  journal: JournalEntry[]
  sessions: FocusSession[]
  settings: Settings
}

export const PALETTE = [
  '#b4451a',
  '#2c4a3c',
  '#1e3a5f',
  '#b8922a',
  '#6b3f5b',
  '#3d6b70',
  '#8b4b2b',
  '#4a5568',
]

export const ROUTES: { id: Route; label: string; hint: string }[] = [
  { id: 'today', label: 'Today', hint: '1' },
  { id: 'tasks', label: 'Tasks', hint: '2' },
  { id: 'calendar', label: 'Calendar', hint: '3' },
  { id: 'habits', label: 'Habits', hint: '4' },
  { id: 'focus', label: 'Focus', hint: '5' },
  { id: 'notes', label: 'Notes', hint: '6' },
  { id: 'goals', label: 'Goals', hint: '7' },
  { id: 'journal', label: 'Journal', hint: '8' },
  { id: 'settings', label: 'Settings', hint: '9' },
]
