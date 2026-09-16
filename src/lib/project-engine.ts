import { parseISO, todayISO } from './dates'
import type {
  Project,
  ProjectBlocker,
  ProjectDecision,
  ProjectHealth,
  ProjectMilestone,
  State,
  VelocityMark,
  WaitingOn,
} from './types'

export function daysLeft(deadline: string, from = todayISO()) {
  return Math.round((parseISO(deadline).getTime() - parseISO(from).getTime()) / 86_400_000)
}

export function daysSince(iso: string, from = todayISO()) {
  return Math.max(0, Math.round((parseISO(from).getTime() - parseISO(iso.slice(0, 10)).getTime()) / 86_400_000))
}

export function addDaysISO(iso: string, n: number) {
  const d = parseISO(iso)
  d.setDate(d.getDate() + n)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function progressOf(milestones: ProjectMilestone[]) {
  if (!milestones.length) return 0
  const done = milestones.filter((m) => m.status === 'complete').length
  return Math.round((done / milestones.length) * 100)
}

export function currentMilestone(milestones: ProjectMilestone[]) {
  const path = milestones.filter((m) => m.criticalPath).sort((a, b) => a.sortOrder - b.sortOrder)
  const list = path.length ? path : [...milestones].sort((a, b) => a.sortOrder - b.sortOrder)
  return list.find((m) => m.status === 'current' || m.status === 'blocked') ?? list.find((m) => m.status !== 'complete')
}

export function nextMilestone(milestones: ProjectMilestone[]) {
  const cur = currentMilestone(milestones)
  const list = [...milestones].sort((a, b) => a.sortOrder - b.sortOrder)
  if (!cur) return list.find((m) => m.status !== 'complete')
  return list.find((m) => m.sortOrder > cur.sortOrder && m.status !== 'complete')
}

export function criticalPathVariance(milestones: ProjectMilestone[]) {
  const today = todayISO()
  let delay = 0
  for (const m of milestones.filter((x) => x.criticalPath).sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (m.status === 'complete') continue
    if (m.plannedEnd && m.plannedEnd < today) delay = Math.max(delay, daysSince(m.plannedEnd))
    if (m.status === 'blocked') delay = Math.max(delay, 1)
  }
  return delay
}

export function projectedCompletion(deadline: string, variance: number) {
  return addDaysISO(deadline, variance)
}

export function primaryBlocker(blockers: ProjectBlocker[]) {
  const open = blockers.filter((b) => !b.resolvedAt)
  return open.find((b) => b.isPrimary) ?? open.sort((a, b) => a.startedAt.localeCompare(b.startedAt))[0]
}

export function pendingDecisions(decisions: ProjectDecision[]) {
  return decisions.filter((d) => d.status === 'pending' || d.status === 'more_info')
}

export function decisionLatencyDays(decisions: ProjectDecision[]) {
  const closed = decisions.filter((d) => d.decidedAt)
  if (!closed.length) return 0
  const sum = closed.reduce((n, d) => n + daysSince(d.requestedAt.slice(0, 10), d.decidedAt!.slice(0, 10)), 0)
  return Math.round((sum / closed.length) * 10) / 10
}

export function healthOf(
  project: Project,
  milestones: ProjectMilestone[],
  blockers: ProjectBlocker[],
  decisions: ProjectDecision[],
): ProjectHealth {
  if (project.state === 'blocked') return 'blocked'
  const variance = criticalPathVariance(milestones)
  const block = primaryBlocker(blockers)
  const blockAge = block ? daysSince(block.startedAt) : 0
  const overdueDecision = pendingDecisions(decisions).some((d) => d.deadline && d.deadline < todayISO())
  const projected = projectedCompletion(project.deadline, variance)
  const slip = daysLeft(project.deadline) - daysLeft(projected)

  if (block && (block.severity === 'critical' || blockAge >= 3) && variance >= 2) return 'critical'
  if (projected > project.deadline && slip <= -5) return 'critical'
  if (block) return blockAge >= 2 || variance >= 1 || overdueDecision ? 'at_risk' : 'at_risk'
  if (variance > 1 || overdueDecision) return 'at_risk'
  const planned = progressOf(
    milestones.filter((m) => (m.plannedEnd && m.plannedEnd <= todayISO()) || m.status === 'complete'),
  )
  const actual = progressOf(milestones)
  if (actual + 15 < planned) return 'at_risk'
  return 'on_track'
}

export function velocityOf(
  _project: Project,
  milestones: ProjectMilestone[],
  blockers: ProjectBlocker[],
  decisions: ProjectDecision[],
): { mark: VelocityMark; planned: number; actual: number; variance: number; latency: number; oldestBlocker: number } {
  const actual = progressOf(milestones)
  const due = milestones.filter((m) => m.plannedEnd && m.plannedEnd <= todayISO())
  const plannedPct = due.length ? Math.round((due.length / Math.max(1, milestones.length)) * 100) : actual
  const variance = criticalPathVariance(milestones)
  const latency = decisionLatencyDays(decisions)
  const open = blockers.filter((b) => !b.resolvedAt)
  const oldestBlocker = open.length ? Math.max(...open.map((b) => daysSince(b.startedAt))) : 0
  let mark: VelocityMark = 'stable'
  if (variance >= 4 || oldestBlocker >= 4) mark = 'critical'
  else if (actual + 8 < plannedPct || variance >= 1) mark = 'slowing'
  else if (actual > plannedPct + 5 && variance === 0) mark = 'accelerating'
  return { mark, planned: plannedPct, actual, variance, latency, oldestBlocker }
}

export function labelHealth(h: ProjectHealth) {
  if (h === 'on_track') return 'ON TRACK'
  if (h === 'at_risk') return 'AT RISK'
  if (h === 'critical') return 'CRITICAL'
  return 'BLOCKED'
}

export function labelState(s: Project['state']) {
  return s.replace('_', ' ').toUpperCase()
}

export function labelVelocity(m: VelocityMark) {
  if (m === 'accelerating') return '↑ ACCELERATING'
  if (m === 'stable') return '→ STABLE'
  if (m === 'slowing') return '↓ SLOWING'
  return '⚠ CRITICAL'
}

export function commanderBrief(input: {
  project: Project
  milestones: ProjectMilestone[]
  blockers: ProjectBlocker[]
  decisions: ProjectDecision[]
  waiting: WaitingOn[]
}) {
  const cur = currentMilestone(input.milestones)
  const block = primaryBlocker(input.blockers)
  const variance = criticalPathVariance(input.milestones)
  const pending = pendingDecisions(input.decisions)
  const lines: string[] = []
  if (block && cur) {
    lines.push(`${cur.name} currently controls the completion date.`)
    lines.push(`${block.title} has been blocked for ${daysSince(block.startedAt)} day${daysSince(block.startedAt) === 1 ? '' : 's'}.`)
    const later = input.milestones.filter((m) => m.sortOrder > (cur.sortOrder ?? 0) && !m.dependsOn.includes(cur.id))
    if (later.length) {
      lines.push(`${later[0]!.name} can begin in parallel. Starting it today could recover time.`)
    } else {
      lines.push(`Clear this bottleneck before downstream work can move.`)
    }
  } else if (pending[0]) {
    lines.push(`Decision “${pending[0].title}” is holding execution. Resolve it to restore velocity.`)
  } else if (variance) {
    lines.push(`Critical path is ${variance} day${variance === 1 ? '' : 's'} late. Compress the current milestone.`)
  } else {
    lines.push(`${input.project.name} is moving. Protect the current milestone and keep decisions under 48 hours.`)
  }
  const plan = [] as { title: string; due?: string; notes?: string }[]
  if (block) plan.push({ title: `Unblock: ${block.title}`, notes: block.description })
  if (cur) {
    const nxt = nextMilestone(input.milestones)
    if (nxt && variance) plan.push({ title: `Prep ${nxt.name} in parallel` })
  }
  return { text: lines.join('\n\n'), plan }
}

export function exceptions(state: State) {
  const today = todayISO()
  const items: { id: string; projectId: string; title: string; detail: string; kind: string }[] = []
  for (const p of state.projects.filter((x) => x.state === 'active' || x.state === 'blocked')) {
    const ms = state.milestones.filter((m) => m.projectId === p.id)
    const bl = state.blockers.filter((b) => b.projectId === p.id)
    const ds = state.projectDecisions.filter((d) => d.projectId === p.id)
    const h = healthOf(p, ms, bl, ds)
    const v = velocityOf(p, ms, bl, ds)
    const block = primaryBlocker(bl)
    if (h === 'critical' || h === 'at_risk') {
      items.push({ id: p.id + '-health', projectId: p.id, title: p.name, detail: `${labelHealth(h)} · ${v.variance}d path`, kind: 'health' })
    }
    if (block) {
      items.push({
        id: block.id,
        projectId: p.id,
        title: p.name,
        detail: `${block.title} · blocked ${daysSince(block.startedAt)}d`,
        kind: 'blocker',
      })
    }
    for (const d of pendingDecisions(ds)) {
      if (d.deadline && d.deadline <= today) {
        items.push({ id: d.id, projectId: p.id, title: d.title, detail: p.name, kind: 'decision' })
      }
    }
  }
  return items
}

export function bar(pct: number) {
  const n = Math.max(0, Math.min(10, Math.round(pct / 10)))
  return '█'.repeat(n) + '░'.repeat(10 - n)
}

export function parseMilestoneLines(raw: string) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:\d+[.)]\s*|[-*•]\s*)/, '').trim())
    .filter(Boolean)
}

export function depsReady(m: ProjectMilestone, all: ProjectMilestone[]) {
  return m.dependsOn.every((id) => all.find((x) => x.id === id)?.status === 'complete')
}

export function waitingEffective(w: WaitingOn, from = todayISO()): WaitingOn['status'] {
  if (w.status === 'received' || w.status === 'cancelled') return w.status
  if (w.dueAt && w.dueAt < from) return 'overdue'
  return w.status
}

export function priorityLabel(score: number, scheduled?: boolean) {
  if (score >= 70) return 'CRITICAL'
  if (score >= 50) return 'MUST MOVE TODAY'
  if (score >= 30) return 'HIGH LEVERAGE'
  if (scheduled) return 'SCHEDULED'
  return 'ROUTINE'
}

export function pickNow(state: State, clockMin: number) {
  const today = todayISO()
  type Row = {
    id: string
    title: string
    projectId?: string
    projectName?: string
    taskId?: string
    label: string
    score: number
    time?: string
  }
  const rows: Row[] = []
  for (const t of state.tasks) {
    if (t.completed || t.blocked || t.waitingOn) continue
    const p = t.projectId ? state.projects.find((x) => x.id === t.projectId) : undefined
    if (p && (p.state === 'blocked' || p.state === 'complete' || p.state === 'archived')) continue
    let score = 0
    if (t.due && t.due < today) score += 40
    else if (t.due === today) score += 30
    else if (!t.due && !t.projectId) continue
    score += (t.priority ?? 0) * 8
    if (p && (p.state === 'active' || p.state === 'backlog')) {
      const ms = state.milestones.filter((m) => m.projectId === p.id)
      const bl = state.blockers.filter((b) => b.projectId === p.id)
      const ds = state.projectDecisions.filter((d) => d.projectId === p.id)
      const cur = currentMilestone(ms)
      const h = healthOf(p, ms, bl, ds)
      if (t.milestoneId && cur && t.milestoneId === cur.id) score += 50
      if (h === 'critical') score += 25
      else if (h === 'at_risk') score += 15
      score += p.priority * 5
      if (daysLeft(p.deadline) <= 7) score += 10
    }
    if (t.dueTime) {
      const [hh, mm] = t.dueTime.split(':').map(Number)
      const mins = (hh ?? 0) * 60 + (mm ?? 0)
      if (mins <= clockMin) score += 12
    }
    rows.push({
      id: t.id,
      title: t.title,
      projectId: t.projectId,
      projectName: p?.name,
      taskId: t.id,
      label: priorityLabel(score, Boolean(t.dueTime)),
      score,
      time: t.dueTime,
    })
  }
  rows.sort((a, b) => b.score - a.score)
  return rows[0]
}

export function portfolioIntel(state: State) {
  const live = state.projects.filter((p) => p.state !== 'archived')
  const active = live.filter((p) => p.state === 'active')
  const month = todayISO().slice(0, 7)
  const completedMonth = live.filter((p) => p.state === 'complete' && p.completedAt?.startsWith(month)).length
  let atRisk = 0
  let blocked = live.filter((p) => p.state === 'blocked').length
  let varianceSum = 0
  let owners: Record<string, number> = {}
  let stale = 0
  const today = todayISO()
  for (const p of active) {
    const ms = state.milestones.filter((m) => m.projectId === p.id)
    const bl = state.blockers.filter((b) => b.projectId === p.id)
    const ds = state.projectDecisions.filter((d) => d.projectId === p.id)
    const h = healthOf(p, ms, bl, ds)
    const v = velocityOf(p, ms, bl, ds)
    if (h === 'at_risk' || h === 'critical') atRisk++
    varianceSum += v.variance
    owners[p.owner] = (owners[p.owner] ?? 0) + 1
    const last = state.projectActivity.find((a) => a.projectId === p.id)
    if (last && daysSince(last.createdAt) >= 5) stale++
  }
  const pending = pendingDecisions(state.projectDecisions)
  const openBlocks = state.blockers.filter((b) => !b.resolvedAt)
  const avgBlock = openBlocks.length ? Math.round((openBlocks.reduce((n, b) => n + daysSince(b.startedAt), 0) / openBlocks.length) * 10) / 10 : 0
  const week = live.filter((p) => daysLeft(p.deadline) >= 0 && daysLeft(p.deadline) <= 7).length
  const avgVar = active.length ? Math.round((varianceSum / active.length) * 10) / 10 : 0
  const mark: VelocityMark = avgVar >= 3 ? 'critical' : avgVar >= 1 ? 'slowing' : atRisk === 0 ? 'accelerating' : 'stable'
  return {
    active: active.length,
    atRisk,
    blocked,
    completedMonth,
    week,
    decisions: pending.length,
    latency: decisionLatencyDays(state.projectDecisions),
    avgBlock,
    stale,
    owners,
    mark,
    dueToday: pending.filter((d) => d.deadline && d.deadline <= today).length,
  }
}
