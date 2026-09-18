import { parseISO, todayISO } from './dates'
import { addDaysISO, daysLeft, healthOf } from './project-engine'
import type {
  EnvironmentAction,
  Goal,
  GoalCategory,
  GoalCheckpoint,
  GoalCycle,
  GoalHealth,
  GoalMover,
  Project,
  ProjectBlocker,
  ProjectDecision,
  ProjectMilestone,
  State,
  TrajectoryMark,
} from './types'

export const GOAL_CATEGORIES: { id: GoalCategory; label: string }[] = [
  { id: 'business', label: 'Business / Career' },
  { id: 'finances', label: 'Finances' },
  { id: 'physique', label: 'Physique' },
  { id: 'mindset', label: 'Mindset' },
  { id: 'relationships', label: 'Relationships' },
  { id: 'fun', label: 'Fun / Recreation' },
  { id: 'spiritual', label: 'Spiritual' },
  { id: 'education', label: 'Education' },
  { id: 'family', label: 'Family' },
  { id: 'health', label: 'Health' },
  { id: 'personal', label: 'Personal' },
  { id: 'custom', label: 'Custom' },
]

export function metricNumber(raw?: string) {
  if (!raw) return null
  const n = Number(String(raw).replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

export function cycleDay(cycle: GoalCycle, from = todayISO()) {
  const total = Math.max(1, daysLeft(cycle.endDate, cycle.startDate))
  const elapsed = Math.max(0, Math.min(total, daysLeft(from, cycle.startDate)))
  return { day: elapsed + 1, total, left: Math.max(0, daysLeft(cycle.endDate, from)) }
}

export function cyclePhase(day: number): 'foundation' | 'momentum' | 'finish' {
  if (day <= 30) return 'foundation'
  if (day <= 60) return 'momentum'
  return 'finish'
}

export function goalProgress(goal: Goal, checkpoints: GoalCheckpoint[]) {
  const b = metricNumber(goal.baseline)
  const c = metricNumber(goal.currentValue)
  const t = metricNumber(goal.targetValue)
  if (b != null && c != null && t != null && t !== b) {
    return Math.round(Math.max(0, Math.min(100, ((c - b) / (t - b)) * 100)))
  }
  if (!checkpoints.length) return goal.progress ?? 0
  const weight = { 30: 0.3, 60: 0.3, 90: 0.4 } as const
  let sum = 0
  for (const cp of checkpoints) {
    const w = weight[cp.day]
    if (cp.status === 'achieved') sum += w
    else if (cp.status === 'on_track') sum += w * 0.7
    else if (cp.status === 'at_risk') sum += w * 0.35
  }
  return Math.round(sum * 100)
}

export function checkpointStatus(cycle: GoalCycle, cp: GoalCheckpoint, from = todayISO()): GoalCheckpoint['status'] {
  if (cp.status === 'achieved' || cp.status === 'missed') return cp.status
  const { day } = cycleDay(cycle, from)
  if (day < cp.day - 2) return 'upcoming'
  const target = metricNumber(cp.targetValue)
  const actual = metricNumber(cp.actualValue)
  if (target != null && actual != null) {
    if (actual >= target) return 'achieved'
    if (day >= cp.day) return actual >= target * 0.9 ? 'at_risk' : 'missed'
    return actual >= target * 0.85 ? 'on_track' : 'at_risk'
  }
  if (day >= cp.day + 3 && cp.status === 'upcoming') return 'at_risk'
  return cp.status
}

export function goalHealth(
  goal: Goal,
  cycle: GoalCycle | undefined,
  checkpoints: GoalCheckpoint[],
  projects: Project[],
  milestones: ProjectMilestone[],
  blockers: ProjectBlocker[],
  decisions: ProjectDecision[],
): GoalHealth {
  if (goal.status === 'done' || goalProgress(goal, checkpoints) >= 100) return 'achieved'
  const pct = goalProgress(goal, checkpoints)
  const cps = cycle ? checkpoints.map((c) => checkpointStatus(cycle, c)) : checkpoints.map((c) => c.status)
  if (cps.includes('missed') || pct + 25 < expectedProgress(cycle)) return 'off_track'
  const projRisk = projects.some((p) => {
    const ms = milestones.filter((m) => m.projectId === p.id)
    const bl = blockers.filter((b) => b.projectId === p.id && !b.resolvedAt)
    const ds = decisions.filter((d) => d.projectId === p.id)
    const h = healthOf(p, ms, bl, ds)
    return h === 'critical' || h === 'blocked'
  })
  if (projRisk || cps.includes('at_risk')) return 'at_risk'
  const atRiskProj = projects.some((p) => {
    const ms = milestones.filter((m) => m.projectId === p.id)
    const bl = blockers.filter((b) => b.projectId === p.id && !b.resolvedAt)
    const ds = decisions.filter((d) => d.projectId === p.id)
    return healthOf(p, ms, bl, ds) === 'at_risk'
  })
  if (atRiskProj) return 'at_risk'
  return 'on_track'
}

function expectedProgress(cycle?: GoalCycle) {
  if (!cycle) return 0
  const { day, total } = cycleDay(cycle)
  return Math.round((day / total) * 100)
}

export function trajectoryOf(goal: Goal, checkpoints: GoalCheckpoint[], cycle?: GoalCycle): TrajectoryMark {
  const pct = goalProgress(goal, checkpoints)
  const exp = expectedProgress(cycle)
  if (pct >= exp + 8) return 'ahead'
  if (pct + 12 < exp) return 'behind'
  return 'on_track'
}

export function labelGoalHealth(h: GoalHealth) {
  if (h === 'on_track') return 'ON TRACK'
  if (h === 'at_risk') return 'AT RISK'
  if (h === 'off_track') return 'OFF TRACK'
  return 'ACHIEVED'
}

export function labelCategory(g: Goal) {
  if (g.category === 'custom' && g.categoryCustom) return g.categoryCustom
  return GOAL_CATEGORIES.find((c) => c.id === g.category)?.label ?? 'PERSONAL'
}

export function qualityCheck(input: {
  title: string
  targetDate?: string
  metricName?: string
  baseline?: string
  targetValue?: string
  day30?: string
  day60?: string
  day90?: string
  movers: number
}) {
  const missing: string[] = []
  if (!input.title.trim()) missing.push('clear outcome')
  if (!input.targetDate) missing.push('target date')
  if (!input.metricName?.trim() && !input.targetValue?.trim()) missing.push('measurable success metric')
  if (!input.baseline?.trim()) missing.push('baseline')
  if (!input.day30?.trim()) missing.push('30-day checkpoint')
  if (!input.day60?.trim()) missing.push('60-day checkpoint')
  if (!input.day90?.trim()) missing.push('90-day target')
  if (input.movers < 1) missing.push('significant movers')
  return { ready: missing.length === 0, missing }
}

export function strategistBrief(args: {
  goal: Goal
  cycle?: GoalCycle
  checkpoints: GoalCheckpoint[]
  projects: Project[]
  movers: GoalMover[]
}) {
  const h = trajectoryOf(args.goal, args.checkpoints, args.cycle)
  const risky = args.projects.find((p) => p.state === 'blocked') ?? args.projects[0]
  const cp60 = args.checkpoints.find((c) => c.day === 60)
  if (h === 'behind' && risky) {
    return `${args.goal.title} is behind. ${risky.name} currently controls progress. Finish its bottleneck before opening more work.`
  }
  if (args.cycle && cp60 && checkpointStatus(args.cycle, cp60) === 'at_risk') {
    return `The 60-day checkpoint needs attention. Keep this week on the highest-leverage mover until that gap closes.`
  }
  if (!args.movers.length) return 'Name 1–3 significant movers. A goal without a few controlling actions will drift.'
  return `Stay on the current movers. Do not add work until the controlling constraint is removed.`
}

export function envScore(actions: EnvironmentAction[], kind: EnvironmentAction['kind'], rating?: number) {
  if (rating != null) return rating
  const rows = actions.filter((a) => a.kind === kind)
  if (!rows.length) return 7
  const done = rows.filter((a) => a.done).length
  return Math.round(3 + (done / rows.length) * 7)
}

export function checkpointDate(cycle: GoalCycle, day: number) {
  return addDaysISO(cycle.startDate, day - 1)
}

export function defaultCycleRange(from = todayISO()) {
  const start = from
  const end = addDaysISO(from, 89)
  const month = parseISO(start).getMonth()
  const q = Math.floor(month / 3) + 1
  const year = parseISO(start).getFullYear()
  return { name: `Q${q} ${year} Execution`, startDate: start, endDate: end }
}

export function linkedGoalId(state: State, taskId?: string, projectId?: string) {
  const task = taskId ? state.tasks.find((t) => t.id === taskId) : undefined
  if (task?.goalId) return task.goalId
  const pid = projectId || task?.projectId
  const project = pid ? state.projects.find((p) => p.id === pid) : undefined
  return project?.goalId
}
