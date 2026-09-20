import { useState } from 'react'
import { Field, Modal } from '../components/ui'
import { bar } from '../lib/project-engine'
import {
  checkpointDate,
  checkpointStatus,
  cycleDay,
  envScore,
  goalHealth,
  goalProgress,
  labelCategory,
  labelGoalHealth,
  strategistBrief,
  trajectoryOf,
} from '../lib/goal-engine'
import { formatShort, todayISO } from '../lib/dates'
import { healthOf, labelHealth } from '../lib/project-engine'
import type { Goal, GoalCycle, NorthStar as Star } from '../lib/types'
import { NorthStar } from '../components/NorthStar'
import { useStore } from '../store'

export function GoalDetail({ goal, cycle, star, onBack }: { goal: Goal; cycle?: GoalCycle; star?: Star; onBack: () => void }) {
  const store = useStore()
  const { state } = store
  const cps = state.goalCheckpoints.filter((c) => c.goalId === goal.id).sort((a, b) => a.day - b.day)
  const movers = state.goalMovers.filter((m) => m.goalId === goal.id).sort((a, b) => a.rank - b.rank)
  const weekly = movers.filter((m) => m.weekly)
  const projects = state.projects.filter((p) => p.goalId === goal.id && p.state !== 'archived')
  const notes = state.notes.filter((n) => n.goalId === goal.id)
  const tasks = state.tasks.filter((t) => t.goalId === goal.id || projects.some((p) => p.id === t.projectId))
  const sessions = state.sessions.filter((s) => s.goalId === goal.id || (s.projectId && projects.some((p) => p.id === s.projectId)))
  const focusMin = Math.round(sessions.filter((s) => s.mode === 'focus').reduce((n, s) => n + s.seconds, 0) / 60)
  const clock = cycle ? cycleDay(cycle) : null
  const progress = goalProgress(goal, cps)
  const health = goalHealth(goal, cycle, cps, projects, state.milestones, state.blockers, state.projectDecisions)
  const traj = trajectoryOf(goal, cps, cycle)
  const [whyOpen, setWhyOpen] = useState(false)
  const [plan, setPlan] = useState(false)
  const [review, setReview] = useState<'weekly' | 'day30' | 'day60' | 'complete' | null>(null)
  const [metric, setMetric] = useState(goal.currentValue ?? '')
  const [pick, setPick] = useState<string[]>([])
  const [planTitle, setPlanTitle] = useState('')
  const [planErr, setPlanErr] = useState('')
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkPick, setLinkPick] = useState<string[]>([])
  const [rv, setRv] = useState({ wins: '', misses: '', constraint: '', lessons: '', adjustments: '', actual: '' })
  const [ask, setAsk] = useState('')
  const [logged, setLogged] = useState('')

  const brief = strategistBrief({ goal, cycle, checkpoints: cps, projects, movers })
  const phase = clock ? (clock.day <= 30 ? 'foundation' : clock.day <= 60 ? 'momentum' : 'finish') : 'foundation'
  const showReward = progress >= 90 && goal.reward
  const due30 = cycle && clock && clock.day >= 30 && !state.goalReviews.some((r) => r.goalId === goal.id && r.type === 'day30')
  const due60 = cycle && clock && clock.day >= 60 && !state.goalReviews.some((r) => r.goalId === goal.id && r.type === 'day60')

  const moverLabel = (m: (typeof movers)[0]) => {
    if (m.entityType === 'project') return state.projects.find((p) => p.id === m.entityId)?.name ?? 'Project'
    if (m.entityType === 'task') return state.tasks.find((t) => t.id === m.entityId)?.title ?? 'Task'
    if (m.entityType === 'habit') return state.habits.find((h) => h.id === m.entityId)?.name ?? 'Habit'
    return state.milestones.find((x) => x.id === m.entityId)?.name ?? 'Milestone'
  }

  const openMover = (m: (typeof movers)[0]) => {
    if (m.entityType === 'project') location.hash = `#/projects/${m.entityId}`
    else if (m.entityType === 'task') location.hash = `#/tasks?project=${state.tasks.find((t) => t.id === m.entityId)?.projectId ?? ''}`
    else if (m.entityType === 'habit') location.hash = '#/habits'
  }

  return (
    <div>
      <NorthStar star={star ?? (cycle?.northStarId ? store.state.northStars.find((n) => n.id === cycle.northStarId) : undefined)} cycle={cycle} />
      <button className="btn-ghost" onClick={onBack}>
        ← Goals
      </button>
      <header className="page-head">
        <div>
          <p className="kicker">Goal // {goal.title}</p>
          <h1>{goal.title}</h1>
          <p className="muted">
            {labelCategory(goal)} · Owner {goal.owner || state.settings.name || 'Kens'}
            {clock ? ` · Day ${clock.day} / ${clock.total}` : ''}
            {goal.targetDate ? ` · Target ${formatShort(goal.targetDate)}` : ''}
          </p>
        </div>
        <div className="row">
          <span className={`health health-${health === 'off_track' ? 'critical' : health === 'achieved' ? 'on_track' : health}`}>
            {labelGoalHealth(health)}
          </span>
          {goal.status !== 'done' ? (
            <button className="btn-ghost" onClick={() => setReview('complete')}>
              Complete
            </button>
          ) : null}
        </div>
      </header>

      <div className="proj-detail">
        <div className="stack">
          <section className="hud-frame" style={{ padding: 16 }}>
            <p className="board-label">The outcome</p>
            <p>{goal.definitionOfDone || goal.notes || goal.title}</p>
            {goal.northStarLink?.trim() ? (
              <p className="north-star-link muted">
                <span className="kicker">North star</span> {goal.northStarLink}
              </p>
            ) : null}
            <p className="muted">
              {goal.metricName || 'Progress'} · current {goal.currentValue ?? '—'} / target {goal.targetValue ?? '—'} {goal.unit}
            </p>
            <p className="proj-bar">
              {bar(progress)} {progress}%
            </p>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <input
                className="input"
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
                placeholder="Update current metric"
              />
              <button
                type="button"
                className="btn"
                onClick={() => {
                  const value = metric.trim()
                  if (!value) {
                    setLogged('Enter a current value first.')
                    return
                  }
                  const next = { ...goal, currentValue: value }
                  store.updateGoal(goal.id, { currentValue: value, progress: goalProgress(next, cps) })
                  setLogged(`Logged ${value}`)
                }}
              >
                Log
              </button>
            </div>
            {logged ? <p className="kicker">{logged}</p> : null}
            <button className="btn-ghost" onClick={() => setWhyOpen((v) => !v)}>
              {whyOpen ? 'Hide' : 'Why this matters'}
            </button>
            {whyOpen ? (
              <div className="muted">
                <p>{goal.whyItMatters || goal.notes || '—'}</p>
                {goal.whyNow ? <p>Why now: {goal.whyNow}</p> : null}
                {goal.consequence ? <p>If not achieved: {goal.consequence}</p> : null}
              </div>
            ) : null}
            {showReward ? (
              <p className="kicker">{goal.status === 'done' ? 'Goal achieved' : 'Reward locked'} — {goal.reward}</p>
            ) : null}
          </section>

          <section className="hud-frame" style={{ padding: 16 }}>
            <p className="board-label">Trajectory</p>
            <p className="muted">
              Baseline {goal.baseline ?? '—'} · Current {goal.currentValue ?? '—'} ·{' '}
              {cps.map((c) => `Day ${c.day} ${c.targetValue || c.targetDescription}`).join(' · ')}
            </p>
            <p>{traj === 'ahead' ? '↗ Ahead' : traj === 'behind' ? '↘ Behind' : '→ On track'}</p>
          </section>

          {cycle ? (
            <section className="hud-frame cpath-panel" style={{ padding: 16 }}>
              <p className="board-label">90-day roadmap</p>
              {([30, 60, 90] as const).map((day) => {
                const cp = cps.find((c) => c.day === day)
                const st = cp ? checkpointStatus(cycle, cp) : 'upcoming'
                const label = day === 30 ? 'Foundation' : day === 60 ? 'Momentum' : 'Finish'
                const inPhase = (day === 30 && phase === 'foundation') || (day === 60 && phase === 'momentum') || (day === 90 && phase === 'finish')
                const phaseProjects = projects.filter((p) => {
                  if (day === 30) return true
                  return p.state !== 'backlog'
                })
                return (
                  <div key={day} className={inPhase ? '' : 'muted'} style={{ marginBottom: 12 }}>
                    <p className="kicker">
                      {label} · Day {day === 30 ? '1–30' : day === 60 ? '31–60' : '61–90'} · {checkpointDate(cycle, day)}
                    </p>
                    <p>
                      <strong>{cp?.targetDescription || '—'}</strong>{' '}
                      <span className={`health health-${st === 'achieved' || st === 'on_track' ? 'on_track' : st === 'upcoming' ? 'on_track' : 'at_risk'}`}>
                        {st.replace('_', ' ')}
                      </span>
                    </p>
                    {phaseProjects.slice(0, day === 30 ? 4 : 3).map((p) => (
                      <button key={p.id} className="board-line" onClick={() => { location.hash = `#/projects/${p.id}` }}>
                        {p.name} · {labelHealth(healthOf(p, state.milestones.filter((m) => m.projectId === p.id), state.blockers.filter((b) => b.projectId === p.id), state.projectDecisions.filter((d) => d.projectId === p.id)))}
                      </button>
                    ))}
                  </div>
                )
              })}
            </section>
          ) : null}

          <section className="hud-frame" style={{ padding: 16 }}>
            <p className="board-label">Significant movers</p>
            {movers.filter((m) => !m.weekly).length === 0 ? <p className="today-empty">No movers linked.</p> : null}
            {movers.filter((m) => !m.weekly).map((m) => (
              <button key={m.id} className="board-line" onClick={() => openMover(m)}>
                {String(m.rank).padStart(2, '0')} {moverLabel(m)} · {m.entityType}
              </button>
            ))}
          </section>

          <section className="hud-frame" style={{ padding: 16 }}>
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <p className="board-label">Projects driving this goal</p>
              <div className="row">
                <button
                  className="btn-ghost"
                  onClick={() => {
                    setLinkPick([])
                    setLinkOpen(true)
                  }}
                >
                  Link project
                </button>
                <button className="btn-ghost" onClick={() => { location.hash = `#/projects?new=1&goal=${encodeURIComponent(goal.id)}` }}>
                  Create project
                </button>
              </div>
            </div>
            {projects.length === 0 ? <p className="today-empty">No projects linked yet.</p> : null}
            {projects.map((p) => {
              const h = healthOf(
                p,
                state.milestones.filter((m) => m.projectId === p.id),
                state.blockers.filter((b) => b.projectId === p.id && !b.resolvedAt),
                state.projectDecisions.filter((d) => d.projectId === p.id),
              )
              return (
                <div key={p.id} className="row" style={{ justifyContent: 'space-between' }}>
                  <button className="board-line" onClick={() => { location.hash = `#/projects/${p.id}` }}>
                    {p.name} · {labelHealth(h)}
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={() => store.updateProject(p.id, { goalId: undefined })}
                  >
                    Unlink
                  </button>
                </div>
              )
            })}
          </section>

          <section className="hud-frame" style={{ padding: 16 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <p className="board-label">This week</p>
              <button
                className="btn-ghost"
                onClick={() => {
                  setPick(weekly.map((m) => m.entityId))
                  setPlanTitle('')
                  setPlanErr('')
                  setPlan(true)
                }}
              >
                Plan week
              </button>
            </div>
            {weekly.length === 0 ? <p className="today-empty">No weekly movers. Plan the week.</p> : null}
            {weekly.map((m) => (
              <button key={m.id} className="board-line" onClick={() => openMover(m)}>
                {moverLabel(m)}
              </button>
            ))}
          </section>
        </div>

        <aside className="stack">
          <section className="hud-frame" style={{ padding: 14 }}>
            <p className="board-label">Execution</p>
            <p className="muted">Tasks {tasks.filter((t) => !t.completed).length} open · Focus {Math.floor(focusMin / 60)}h {focusMin % 60}m</p>
            <button className="chip" onClick={() => { location.hash = `#/notes?goal=${goal.id}` }}>
              Notes {notes.length}
            </button>
            <button className="chip" onClick={() => { location.hash = `#/focus?goal=${goal.id}` }}>
              Focus
            </button>
          </section>
          {due30 || due60 ? (
            <section className="hud-frame" style={{ padding: 14 }}>
              <p className="board-label warn">{due30 ? 'Day 30 review due' : 'Day 60 review due'}</p>
              <button className="btn" onClick={() => setReview(due30 ? 'day30' : 'day60')}>
                Open review
              </button>
            </section>
          ) : null}
          <section className="hud-frame" style={{ padding: 14 }}>
            <p className="board-label">Sepho // Goal strategist</p>
            <p className="board-brief">{brief}</p>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => setPlan(true)}>
                Apply to week
              </button>
              <button className="btn-ghost" onClick={() => setReview('weekly')}>
                Weekly review
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!ask.trim()) return
                store.addGoalReview({ goalId: goal.id, cycleId: cycle?.id, type: 'weekly', wins: `Asked Sepho: ${ask.trim()}`, misses: '', constraint: '', lessons: '', adjustments: '' })
                setAsk('')
              }}
            >
              <input className="input" value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Ask Sepho…" />
            </form>
          </section>
          {cycle ? (
            <section className="hud-frame" style={{ padding: 14 }}>
              <p className="board-label">Environment</p>
              <p className="muted">
                Physical {envScore(state.envActions.filter((a) => a.cycleId === cycle.id), 'physical', cycle.physicalRating)} / 10 · Digital{' '}
                {envScore(state.envActions.filter((a) => a.cycleId === cycle.id), 'digital', cycle.digitalRating)} / 10
              </p>
            </section>
          ) : null}
        </aside>
      </div>

      {linkOpen ? (
        <Modal title="Link projects" onClose={() => setLinkOpen(false)}>
          <p className="muted">Attach existing projects to this goal. Same project record — not a copy.</p>
          {state.projects.filter((p) => p.state !== 'archived' && p.goalId !== goal.id).length === 0 ? (
            <p className="today-empty">No other projects to link. Create one instead.</p>
          ) : null}
          {state.projects
            .filter((p) => p.state !== 'archived' && p.goalId !== goal.id)
            .map((p) => (
              <label key={p.id} className="row">
                <input
                  type="checkbox"
                  checked={linkPick.includes(p.id)}
                  onChange={(e) => setLinkPick((ids) => (e.target.checked ? [...ids, p.id] : ids.filter((x) => x !== p.id)))}
                />
                {p.name}
                {p.goalId ? <span className="muted"> · other goal</span> : null}
              </label>
            ))}
          <button
            type="button"
            className="btn"
            onClick={() => {
              linkPick.forEach((id) => store.updateProject(id, { goalId: goal.id }))
              setLinkOpen(false)
            }}
          >
            Link selected
          </button>
        </Modal>
      ) : null}

      {plan ? (
        <Modal title="Plan week" onClose={() => setPlan(false)}>
          <p className="muted">Select 1–3 movers. Check significant movers, open tasks, or type a new task.</p>
          {movers.filter((m) => !m.weekly).map((m) => (
            <label key={`m-${m.id}`} className="row">
              <input
                type="checkbox"
                checked={pick.includes(m.entityId)}
                onChange={(e) => setPick((ids) => (e.target.checked ? [...ids, m.entityId] : ids.filter((x) => x !== m.entityId)))}
              />
              {moverLabel(m)} · {m.entityType}
            </label>
          ))}
          {projects.map((p) => (
            <label key={`p-${p.id}`} className="row">
              <input
                type="checkbox"
                checked={pick.includes(p.id)}
                onChange={(e) => setPick((ids) => (e.target.checked ? [...ids, p.id] : ids.filter((x) => x !== p.id)))}
              />
              Project: {p.name}
            </label>
          ))}
          {tasks.filter((t) => !t.completed).slice(0, 16).map((t) => (
            <label key={`t-${t.id}`} className="row">
              <input
                type="checkbox"
                checked={pick.includes(t.id)}
                onChange={(e) => setPick((ids) => (e.target.checked ? [...ids, t.id] : ids.filter((x) => x !== t.id)))}
              />
              Task: {t.title}
            </label>
          ))}
          <Field label="Or create a task for this week">
            <input className="input" value={planTitle} onChange={(e) => setPlanTitle(e.target.value)} placeholder="e.g. Pray morning, noon, and night" />
          </Field>
          {planErr ? <p className="gate-error">{planErr}</p> : null}
          <button
            type="button"
            className="btn"
            onClick={() => {
              const items: { entityType: 'project' | 'task' | 'habit' | 'milestone'; entityId: string }[] = []
              const seen = new Set<string>()
              const push = (entityType: (typeof items)[0]['entityType'], entityId: string) => {
                if (!entityId || seen.has(entityId)) return
                seen.add(entityId)
                items.push({ entityType, entityId })
              }
              for (const id of pick) {
                const mover = movers.find((m) => m.entityId === id)
                if (mover) push(mover.entityType, id)
                else if (projects.some((p) => p.id === id)) push('project', id)
                else push('task', id)
              }
              if (planTitle.trim()) {
                const id = store.addTask({ title: planTitle.trim(), listId: 'work', goalId: goal.id, due: todayISO() })
                push('task', id)
              }
              if (!items.length) {
                setPlanErr('Pick at least one mover or type a task.')
                return
              }
              store.setWeeklyMovers(goal.id, items.slice(0, 3))
              setPlan(false)
            }}
          >
            Set weekly movers
          </button>
        </Modal>
      ) : null}

      {review ? (
        <Modal title={review === 'complete' ? 'Close goal' : review === 'weekly' ? 'Weekly review' : `${review} review`} onClose={() => setReview(null)}>
          <NorthStar star={star ?? (cycle?.northStarId ? store.state.northStars.find((n) => n.id === cycle.northStarId) : undefined)} cycle={cycle} />
          {review !== 'weekly' && review !== 'complete' ? (
            <p className="muted">
              Planned {cps.find((c) => c.day === (review === 'day30' ? 30 : 60))?.targetDescription} · Current {goal.currentValue ?? '—'}
            </p>
          ) : null}
          {review === 'complete' ? (
            <>
              <p className="muted">Target {goal.targetValue} · Current {goal.currentValue}</p>
              <Field label="Final result">
                <input className="input" value={rv.actual} onChange={(e) => setRv({ ...rv, actual: e.target.value })} />
              </Field>
            </>
          ) : null}
          <Field label="What moved forward?">
            <textarea className="textarea" value={rv.wins} onChange={(e) => setRv({ ...rv, wins: e.target.value })} />
          </Field>
          <Field label="What did not move?">
            <textarea className="textarea" value={rv.misses} onChange={(e) => setRv({ ...rv, misses: e.target.value })} />
          </Field>
          <Field label="Biggest constraint">
            <input className="input" value={rv.constraint} onChange={(e) => setRv({ ...rv, constraint: e.target.value })} />
          </Field>
          <Field label="What did you learn?">
            <textarea className="textarea" value={rv.lessons} onChange={(e) => setRv({ ...rv, lessons: e.target.value })} />
          </Field>
          <Field label="Plan change (will not auto-edit the 90-day target)">
            <textarea className="textarea" value={rv.adjustments} onChange={(e) => setRv({ ...rv, adjustments: e.target.value })} />
          </Field>
          <button
            className="btn"
            onClick={() => {
              store.addGoalReview({
                goalId: goal.id,
                cycleId: cycle?.id,
                type: review,
                day: review === 'day30' ? 30 : review === 'day60' ? 60 : review === 'complete' ? 90 : undefined,
                ...rv,
              })
              if (review === 'day30' || review === 'day60') {
                const cp = cps.find((c) => c.day === (review === 'day30' ? 30 : 60))
                if (cp) store.updateCheckpoint(cp.id, { actualValue: goal.currentValue, actualDescription: rv.wins, reviewNotes: rv.lessons })
              }
              if (review === 'complete') {
                store.updateGoal(goal.id, { status: 'done', completedAt: todayISO(), outcomeActual: rv.actual || goal.currentValue, lessons: rv.lessons, progress: 100 })
              }
              setReview(null)
            }}
          >
            Save review
          </button>
        </Modal>
      ) : null}
    </div>
  )
}
