export type Priority = 0 | 1 | 2 | 3
export type ThemeMode = 'light' | 'dark' | 'system'
export type Route =
  | 'today'
  | 'tasks'
  | 'calendar'
  | 'projects'
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
  blocked?: boolean
  waitingOn?: string
  decision?: boolean
  projectId?: string
  milestoneId?: string
  workstreamId?: string
  goalId?: string
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
  projectId?: string
  goalId?: string
}

export type GoalStatus = 'backlog' | 'active' | 'paused' | 'done'
export type GoalHealth = 'on_track' | 'at_risk' | 'off_track' | 'achieved'
export type GoalCategory =
  | 'business'
  | 'finances'
  | 'physique'
  | 'mindset'
  | 'relationships'
  | 'fun'
  | 'spiritual'
  | 'education'
  | 'family'
  | 'health'
  | 'personal'
  | 'custom'
export type CheckpointDay = 30 | 60 | 90
export type CheckpointStatus = 'achieved' | 'on_track' | 'at_risk' | 'missed' | 'upcoming'
export type MoverEntity = 'project' | 'task' | 'habit' | 'milestone'
export type GoalReviewType = 'weekly' | 'day30' | 'day60' | 'day90' | 'complete'
export type TrajectoryMark = 'ahead' | 'on_track' | 'behind'

export interface GoalCycle {
  id: string
  name: string
  startDate: string
  endDate: string
  status: 'active' | 'complete'
  activeGoalLimit: number
  createdAt: string
  completedAt?: string
  physicalRating?: number
  digitalRating?: number
  physicalHelp?: string
  physicalFriction?: string
  digitalSteal?: string
  digitalChange?: string
}

export interface Goal {
  id: string
  title: string
  notes: string
  targetDate?: string
  progress: number
  status: GoalStatus
  createdAt: string
  cycleId?: string
  owner?: string
  category?: GoalCategory
  categoryCustom?: string
  startDate?: string
  whyItMatters?: string
  whyNow?: string
  consequence?: string
  metricName?: string
  baseline?: string
  currentValue?: string
  targetValue?: string
  unit?: string
  definitionOfDone?: string
  reward?: string
  completedAt?: string
  outcomeActual?: string
  lessons?: string
}

export interface GoalCheckpoint {
  id: string
  goalId: string
  day: CheckpointDay
  targetValue?: string
  targetDescription: string
  actualValue?: string
  actualDescription?: string
  status: CheckpointStatus
  reviewNotes?: string
}

export interface GoalMover {
  id: string
  goalId: string
  rank: number
  entityType: MoverEntity
  entityId: string
  weekly?: boolean
}

export interface GoalReview {
  id: string
  goalId?: string
  cycleId?: string
  type: GoalReviewType
  weekNumber?: number
  day?: number
  wins: string
  misses: string
  constraint: string
  lessons: string
  adjustments: string
  createdAt: string
}

export interface EnvironmentAction {
  id: string
  cycleId: string
  kind: 'physical' | 'digital'
  action: 'remove' | 'improve'
  description: string
  taskId?: string
  habitId?: string
  done: boolean
}

export type Workout = 'cardio' | 'weights' | 'rest' | 'other'

export interface JournalEntry {
  date: string
  mood?: 1 | 2 | 3 | 4 | 5
  body: string
  updatedAt: string
  blessings: [string, string, string]
  workout?: Workout
  currentGoals: string
  actionsToday: string
  actionsTomorrow: string
  affirmation: string
  shortTermGoal: string
  morningWins: [string, string, string]
  morningChecks: [boolean, boolean, boolean]
}

export interface FocusSession {
  id: string
  mode: TimerMode
  seconds: number
  startedAt: string
  endedAt: string
  taskId?: string
  projectId?: string
  goalId?: string
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
  morningRituals: [string, string, string]
  activeProjectLimit: number
  activeGoalLimit: number
}

export type ProjectLifecycle = 'backlog' | 'active' | 'blocked' | 'complete' | 'archived'
export type ProjectHealth = 'on_track' | 'at_risk' | 'critical' | 'blocked'
export type MilestoneStatus = 'complete' | 'current' | 'upcoming' | 'blocked'
export type DecisionStatus = 'pending' | 'approved' | 'rejected' | 'more_info' | 'delegated' | 'resolved'
export type WaitingStatus = 'open' | 'overdue' | 'received' | 'cancelled'
export type VelocityMark = 'accelerating' | 'stable' | 'slowing' | 'critical'
export type OutcomeGrade = 'success' | 'partial' | 'failed'

export interface Project {
  id: string
  name: string
  company: string
  owner: string
  goalId?: string
  objective: string
  definitionOfDone: string
  successMetric: string
  why: string
  constraints: string
  problem: string
  desiredOutcome: string
  assumptions: string
  killPivot: string
  state: ProjectLifecycle
  priority: number
  startDate?: string
  deadline: string
  createdAt: string
  updatedAt: string
  completedAt?: string
  outcome?: string
  outcomeGrade?: OutcomeGrade
  lessons?: string
  primaryBottleneckId?: string
}

export interface ProjectMilestone {
  id: string
  projectId: string
  workstreamId?: string
  name: string
  owner: string
  plannedStart?: string
  plannedEnd?: string
  actualEnd?: string
  status: MilestoneStatus
  criticalPath: boolean
  sortOrder: number
  notes: string
  dependsOn: string[]
}

export interface ProjectWorkstream {
  id: string
  projectId: string
  name: string
  owner: string
}

export interface ProjectDecision {
  id: string
  projectId: string
  milestoneId?: string
  title: string
  description: string
  requestedBy: string
  owner: string
  requestedAt: string
  deadline?: string
  status: DecisionStatus
  decision?: string
  decidedAt?: string
  impactIfDelayed: string
  context: string
}

export interface ProjectBlocker {
  id: string
  projectId: string
  milestoneId?: string
  title: string
  description: string
  owner: string
  startedAt: string
  expectedResolution?: string
  resolvedAt?: string
  severity: 'normal' | 'high' | 'critical'
  delayDays: number
  isPrimary: boolean
}

export interface WaitingOn {
  id: string
  projectId?: string
  milestoneId?: string
  person: string
  deliverable: string
  requestedAt: string
  dueAt?: string
  status: WaitingStatus
  importance: 'normal' | 'high' | 'critical'
}

export interface ProjectActivity {
  id: string
  projectId: string
  type: string
  description: string
  createdAt: string
}

export interface State {
  version: 1
  savedAt?: number
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
  projects: Project[]
  milestones: ProjectMilestone[]
  workstreams: ProjectWorkstream[]
  projectDecisions: ProjectDecision[]
  blockers: ProjectBlocker[]
  waitingOnItems: WaitingOn[]
  projectActivity: ProjectActivity[]
  goalCycles: GoalCycle[]
  goalCheckpoints: GoalCheckpoint[]
  goalMovers: GoalMover[]
  goalReviews: GoalReview[]
  envActions: EnvironmentAction[]
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
  '#4285f4',
  '#0b8043',
  '#d50000',
  '#f6bf26',
  '#8e24aa',
  '#039be5',
  '#e67c73',
  '#33b679',
]

export function colorFromKey(key: string, colors: string[] = PALETTE) {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 33 + key.charCodeAt(i)) >>> 0
  return colors[h % colors.length] ?? colors[0] ?? '#4285f4'
}

export function nextEventColor(used: string[], colors: string[] = PALETTE) {
  const counts = colors.map((c) => used.filter((u) => u.toLowerCase() === c.toLowerCase()).length)
  const min = Math.min(...counts)
  return colors[counts.findIndex((n) => n === min)] ?? colors[0] ?? '#4285f4'
}

export const ROUTES: { id: Route; label: string; hint: string }[] = [
  { id: 'today', label: 'Today', hint: '1' },
  { id: 'tasks', label: 'Tasks', hint: '2' },
  { id: 'calendar', label: 'Calendar', hint: '3' },
  { id: 'projects', label: 'Projects', hint: '4' },
  { id: 'habits', label: 'Habits', hint: '5' },
  { id: 'focus', label: 'Focus', hint: '6' },
  { id: 'notes', label: 'Notes', hint: '7' },
  { id: 'goals', label: 'Goals', hint: '8' },
  { id: 'journal', label: 'Journal', hint: '9' },
  { id: 'settings', label: 'Settings', hint: '0' },
]
