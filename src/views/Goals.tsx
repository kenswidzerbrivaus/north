import { useEffect, useMemo, useState } from 'react'
import { Field, Modal } from '../components/ui'
import { bar } from '../lib/project-engine'
import {
  checkpointStatus,
  cycleDay,
  defaultCycleRange,
  envScore,
  goalHealth,
  goalProgress,
  labelCategory,
  labelGoalHealth,
  strategistBrief,
} from '../lib/goal-engine'
import { formatShort, todayISO } from '../lib/dates'
import { goalIdFromHash } from '../lib/route'
import type { Goal } from '../lib/types'
import { useStore } from '../store'
import { GoalDetail } from './GoalDetail'
import { GoalWizard } from './GoalWizard'

export function Goals() {
  const store = useStore()
  const { state, addCycle, addEnvAction, addTask, updateCycle, updateGoal } = store
  const [openId, setOpenId] = useState(() => goalIdFromHash())
  const [creating, setCreating] = useState(() => location.hash.includes('new=1'))
  const [tab, setTab] = useState<'current' | 'backlog' | 'history'>('current')
  const [cap, setCap] = useState(false)
  const [override, setOverride] = useState(false)
  const [envOpen, setEnvOpen] = useState(false)
  const [cycleForm, setCycleForm] = useState(false)
  const [envDraft, setEnvDraft] = useState({ physical: '', digital: '', ratingP: '7', ratingD: '6' })
  const [review90, setReview90] = useState(false)

  useEffect(() => {
    const on = () => {
      setOpenId(goalIdFromHash())
      setCreating(location.hash.includes('new=1'))
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  useEffect(() => {
    if (state.goalCycles.length) return
    const range = defaultCycleRange(todayISO())
    const id = addCycle(range)
    const live = state.goals.filter((g) => g.status === 'active' || g.status === 'paused' || g.status === 'done')
    live.forEach((g, i) => updateGoal(g.id, { cycleId: id, status: i < 3 && g.status !== 'done' ? g.status : g.status === 'done' ? 'done' : 'backlog' }))
  }, [addCycle, state.goalCycles.length, state.goals, updateGoal])

  const cycle = state.goalCycles.find((c) => c.status === 'active') ?? state.goalCycles[0]
  const clock = cycle ? cycleDay(cycle) : null
  const cycleGoals = state.goals.filter((g) => !cycle || g.cycleId === cycle.id)
  const active = cycleGoals.filter((g) => g.status === 'active')
  const backlog = cycleGoals.filter((g) => g.status === 'backlog' || g.status === 'paused')
  const past = state.goalCycles.filter((c) => c.status === 'complete')
  const limit = cycle?.activeGoalLimit ?? state.settings.activeGoalLimit ?? 3

  const cards = useMemo(() => {
    return active.map((g) => {
      const cps = state.goalCheckpoints.filter((c) => c.goalId === g.id)
      const projects = state.projects.filter((p) => p.goalId === g.id && p.state !== 'archived')
      const health = goalHealth(g, cycle, cps, projects, state.milestones, state.blockers, state.projectDecisions)
      return { g, cps, projects, health, progress: goalProgress(g, cps) }
    })
  }, [active, cycle, state.blockers, state.goalCheckpoints, state.milestones, state.projectDecisions, state.projects])

  const atRisk = cards.filter((c) => c.health === 'at_risk' || c.health === 'off_track').length
  const envA = cycle ? state.envActions.filter((a) => a.cycleId === cycle.id) : []
  const weekMovers = state.goalMovers.filter((m) => m.weekly && cycleGoals.some((g) => g.id === m.goalId))
  const weekDone = weekMovers.filter((m) => {
    if (m.entityType !== 'task') return false
    return state.tasks.find((t) => t.id === m.entityId)?.completed
  }).length

  const openCreate = () => {
    if (active.length >= limit) setCap(true)
    else setCreating(true)
  }

  if (openId) {
    const g = state.goals.find((x) => x.id === openId)
    if (g) {
      return (
        <GoalDetail
          goal={g}
          cycle={state.goalCycles.find((c) => c.id === g.cycleId) ?? cycle}
          onBack={() => {
            location.hash = '#/goals'
          }}
        />
      )
    }
  }

  return (
    <div>
      <header className="page-head">
        <div>
          <p className="kicker">Goals // 90-day command</p>
          <h1>{cycle?.name ?? 'Goals'}</h1>
          {clock ? (
            <p className="muted">
              Day {clock.day} / {clock.total} · {clock.left} days left
            </p>
          ) : null}
        </div>
        <div className="row">
          <button className="btn-ghost" onClick={() => setEnvOpen(true)} disabled={!cycle}>
            Environment
          </button>
          <button className="btn" onClick={openCreate}>
            + New goal
          </button>
        </div>
      </header>

      {clock ? (
        <p className="proj-bar" style={{ marginBottom: 12 }}>
          {bar(Math.round((clock.day / clock.total) * 100))} {Math.round((clock.day / clock.total) * 100)}% of cycle
        </p>
      ) : null}

      <div className="row" style={{ marginBottom: 12 }}>
        {(['current', 'backlog', 'history'] as const).map((t) => (
          <button key={t} className="chip" data-on={tab === t} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
        {clock && clock.day >= 90 && cycle?.status === 'active' ? (
          <button className="chip" data-on onClick={() => setReview90(true)}>
            90-day review
          </button>
        ) : null}
      </div>

      <div className="proj-cc">
        <div>
          {tab === 'current' && !cards.length ? (
            <div className="hud-frame empty">
              <p className="kicker">90-day system online</p>
              <h3>No active goals</h3>
              <p className="muted">Define an outcome. Projects and tasks will drive it.</p>
              <button className="btn" onClick={openCreate}>
                Create first goal
              </button>
            </div>
          ) : null}

          {tab === 'current' && cards.length ? (
            <>
              <div className="goal-roadmap hud-frame" style={{ padding: 12, marginBottom: 12 }}>
                <p className="board-label">30 / 60 / 90</p>
                <div className="goal-grid">
                  <span />
                  {cards.slice(0, 3).map((c) => (
                    <strong key={c.g.id}>{c.g.title}</strong>
                  ))}
                  {([30, 60, 90] as const).map((day) => (
                    <RowCheck key={day} day={day} cards={cards} cycle={cycle} />
                  ))}
                </div>
              </div>
              <div className="proj-grid">
                {cards.map((c, i) => (
                  <GoalCard key={c.g.id} index={i + 1} {...c} />
                ))}
              </div>
            </>
          ) : null}

          {tab === 'backlog' ? (
            backlog.length ? (
              backlog.map((g) => (
                <button key={g.id} className="board-line" onClick={() => { location.hash = `#/goals/${g.id}` }}>
                  {g.title} · {g.status}
                </button>
              ))
            ) : (
              <p className="muted">No backlog goals.</p>
            )
          ) : null}

          {tab === 'history' ? (
            past.length ? (
              past.map((c) => {
                const gs = state.goals.filter((g) => g.cycleId === c.id)
                const won = gs.filter((g) => g.status === 'done').length
                return (
                  <p key={c.id} className="board-line">
                    {c.name} · {won} / {gs.length} achieved · {formatShort(c.startDate)}–{formatShort(c.endDate)}
                  </p>
                )
              })
            ) : (
              <p className="muted">No past cycles yet.</p>
            )
          ) : null}
        </div>

        <aside className="stack proj-rail">
          <section className="hud-frame" style={{ padding: 14 }}>
            <p className="board-label">90-day status</p>
            {clock ? (
              <p>
                Day {clock.day} / {clock.total}
              </p>
            ) : null}
            <p className="muted">
              {active.length} active · {cards.filter((c) => c.health === 'on_track' || c.health === 'achieved').length} on track · {atRisk} at risk
            </p>
            {cycle ? (
              <p className="muted">
                Next checkpoint {Math.max(0, (clock && clock.day < 30 ? 30 : clock && clock.day < 60 ? 60 : 90) - (clock?.day ?? 0))} days
              </p>
            ) : null}
          </section>
          <section className="hud-frame" style={{ padding: 14 }}>
            <p className="board-label">This week</p>
            <p>
              {weekMovers.length} movers · {weekDone} done
            </p>
          </section>
          <section className="hud-frame" style={{ padding: 14 }}>
            <p className="board-label">Environment</p>
            <p className="muted">
              Physical {cycle ? envScore(envA, 'physical', cycle.physicalRating) : '—'} / 10 · Digital {cycle ? envScore(envA, 'digital', cycle.digitalRating) : '—'} / 10
            </p>
            <p className="muted">Open {envA.filter((a) => !a.done).length}</p>
          </section>
          <section className="hud-frame" style={{ padding: 14 }}>
            <p className="board-label">Sepho // Strategy</p>
            <p className="board-brief">
              {cards[0]
                ? strategistBrief({
                    goal: cards[0].g,
                    cycle,
                    checkpoints: cards[0].cps,
                    projects: cards[0].projects,
                    movers: state.goalMovers.filter((m) => m.goalId === cards[0].g.id),
                  })
                : 'Set three outcomes for this 90-day cycle.'}
            </p>
          </section>
          <button className="btn-ghost" onClick={() => setCycleForm(true)}>
            New 90-day cycle
          </button>
        </aside>
      </div>

      {creating && cycle ? (
        <GoalWizard
          cycleId={cycle.id}
          startDate={cycle.startDate}
          endDate={cycle.endDate}
          override={override}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false)
            setOverride(false)
            location.hash = `#/goals/${id}`
          }}
        />
      ) : null}

      {cap ? (
        <Modal title="Focus capacity reached" onClose={() => setCap(false)}>
          <p className="muted">You already have {active.length} active 90-day goals (limit {limit}).</p>
          {active.map((g) => (
            <div key={g.id} className="row" style={{ justifyContent: 'space-between' }}>
              <span>{g.title}</span>
              <button className="btn-ghost" onClick={() => updateGoal(g.id, { status: 'paused' })}>
                Pause
              </button>
            </div>
          ))}
          <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button className="btn-ghost" onClick={() => setCap(false)}>
              Cancel
            </button>
            <button
              className="btn"
              onClick={() => {
                if (!confirm('Override active goal capacity?')) return
                setOverride(true)
                setCap(false)
                setCreating(true)
              }}
            >
              Override
            </button>
          </div>
        </Modal>
      ) : null}

      {envOpen && cycle ? (
        <Modal title="Environment check" onClose={() => setEnvOpen(false)} wide>
          <p className="muted">Once per 90-day cycle. Actions become existing tasks.</p>
          <Field label="Physical — what makes execution easier / what creates friction?">
            <textarea className="textarea" value={envDraft.physical} onChange={(e) => setEnvDraft({ ...envDraft, physical: e.target.value })} />
          </Field>
          <div className="grid-2">
            <Field label="Physical rating 1–10">
              <input className="input" value={envDraft.ratingP} onChange={(e) => setEnvDraft({ ...envDraft, ratingP: e.target.value })} />
            </Field>
            <Field label="Digital rating 1–10">
              <input className="input" value={envDraft.ratingD} onChange={(e) => setEnvDraft({ ...envDraft, ratingD: e.target.value })} />
            </Field>
          </div>
          <Field label="Digital — what is stealing attention?">
            <textarea className="textarea" value={envDraft.digital} onChange={(e) => setEnvDraft({ ...envDraft, digital: e.target.value })} />
          </Field>
          <p className="kicker">Open improvements</p>
          {envA.map((a) => (
            <label key={a.id} className="row">
              <input type="checkbox" checked={a.done} onChange={(e) => store.updateEnvAction(a.id, { done: e.target.checked })} />
              {a.description}
            </label>
          ))}
          <div className="row">
            <button
              className="btn"
              onClick={() => {
                updateCycle(cycle.id, {
                  physicalHelp: envDraft.physical,
                  digitalSteal: envDraft.digital,
                  physicalRating: Number(envDraft.ratingP) || undefined,
                  digitalRating: Number(envDraft.ratingD) || undefined,
                })
                envDraft.physical
                  .split('\n')
                  .map((l) => l.trim())
                  .filter(Boolean)
                  .forEach((d) => {
                    const taskId = addTask({ title: d, listId: 'personal' })
                    addEnvAction({ cycleId: cycle.id, kind: 'physical', action: 'improve', description: d, taskId })
                  })
                envDraft.digital
                  .split('\n')
                  .map((l) => l.trim())
                  .filter(Boolean)
                  .forEach((d) => {
                    const taskId = addTask({ title: d, listId: 'personal' })
                    addEnvAction({ cycleId: cycle.id, kind: 'digital', action: 'remove', description: d, taskId })
                  })
                setEnvOpen(false)
              }}
            >
              Save environment
            </button>
          </div>
        </Modal>
      ) : null}

      {cycleForm ? (
        <CycleForm
          onClose={() => setCycleForm(false)}
          onCreate={(name, start, end) => {
            addCycle({ name, startDate: start, endDate: end })
            setCycleForm(false)
          }}
        />
      ) : null}

      {review90 && cycle ? (
        <Modal title="90-day review" onClose={() => setReview90(false)} wide>
          {cards.concat(
            cycleGoals.filter((g) => g.status === 'done').map((g) => ({
              g,
              cps: state.goalCheckpoints.filter((c) => c.goalId === g.id),
              projects: state.projects.filter((p) => p.goalId === g.id),
              health: 'achieved' as const,
              progress: 100,
            })),
          ).map((c) => (
            <p key={c.g.id}>
              <strong>{c.g.title}</strong> target {c.g.targetValue ?? '—'} · actual {c.g.currentValue ?? c.g.outcomeActual ?? '—'} · {c.g.status}
            </p>
          ))}
          <p className="muted">
            Achieved {cycleGoals.filter((g) => g.status === 'done').length} / {cycleGoals.filter((g) => g.status !== 'backlog').length}
          </p>
          <button
            className="btn"
            onClick={() => {
              const range = defaultCycleRange(todayISO())
              addCycle(range)
              setReview90(false)
            }}
          >
            Start next 90-day cycle
          </button>
        </Modal>
      ) : null}
    </div>
  )
}

function GoalCard({ g, cps, projects, health, progress, index }: { g: Goal; cps: ReturnType<typeof useStore>['state']['goalCheckpoints']; projects: ReturnType<typeof useStore>['state']['projects']; health: ReturnType<typeof goalHealth>; progress: number; index: number }) {
  const { state } = useStore()
  const movers = state.goalMovers.filter((m) => m.goalId === g.id && !m.weekly).sort((a, b) => a.rank - b.rank)
  const nameOf = (id: string, type: string) => {
    if (type === 'project') return state.projects.find((p) => p.id === id)?.name
    if (type === 'task') return state.tasks.find((t) => t.id === id)?.title
    if (type === 'habit') return state.habits.find((h) => h.id === id)?.name
    return state.milestones.find((m) => m.id === id)?.name
  }
  return (
    <article className="hud-frame proj-card" onClick={() => { location.hash = `#/goals/${g.id}` }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <p className="kicker">Goal {String(index).padStart(2, '0')}</p>
        <span className={`health health-${health === 'off_track' ? 'critical' : health === 'achieved' ? 'on_track' : health}`}>{labelGoalHealth(health)}</span>
      </div>
      <h3>{g.title}</h3>
      <p className="kicker">{labelCategory(g)}</p>
      <p className="muted">
        {g.metricName || 'Target'} {g.targetValue ?? ''} {g.unit} · current {g.currentValue ?? '—'}
        {g.targetDate ? ` · ${formatShort(g.targetDate)}` : ''}
      </p>
      <p className="proj-bar">
        {bar(progress)} {progress}%
      </p>
      {cps.map((c) => (
        <p key={c.id} className="muted">
          {c.day}d {c.targetDescription} · {c.status.replace('_', ' ')}
        </p>
      ))}
      <p className="muted">Projects {projects.length} · Movers {movers.slice(0, 3).map((m) => nameOf(m.entityId, m.entityType)).filter(Boolean).join(' · ') || '—'}</p>
      <button
        className="btn-ghost"
        onClick={(e) => {
          e.stopPropagation()
          location.hash = `#/goals/${g.id}`
        }}
      >
        Open goal
      </button>
    </article>
  )
}

function RowCheck({ day, cards, cycle }: { day: 30 | 60 | 90; cards: { g: Goal; cps: ReturnType<typeof useStore>['state']['goalCheckpoints'] }[]; cycle?: ReturnType<typeof useStore>['state']['goalCycles'][0] }) {
  return (
    <>
      <span className="kicker">{day} days</span>
      {cards.slice(0, 3).map((c) => {
        const cp = c.cps.find((x) => x.day === day)
        const st = cycle && cp ? checkpointStatus(cycle, cp) : cp?.status ?? 'upcoming'
        return (
          <span key={c.g.id + day} className="muted">
            {cp?.targetDescription || '—'} · {st.replace('_', ' ')}
          </span>
        )
      })}
    </>
  )
}

function CycleForm({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string, start: string, end: string) => void }) {
  const range = defaultCycleRange(todayISO())
  const [name, setName] = useState(range.name)
  const [start, setStart] = useState(range.startDate)
  const [end, setEnd] = useState(range.endDate)
  return (
    <Modal title="New 90-day cycle" onClose={onClose}>
      <Field label="Name">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Start">
        <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
      </Field>
      <Field label="End">
        <input className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
      </Field>
      <button className="btn" onClick={() => onCreate(name.trim() || range.name, start, end)}>
        Start cycle
      </button>
    </Modal>
  )
}
