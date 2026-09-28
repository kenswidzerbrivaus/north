import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { DateField } from '../components/DateField'
import { Field, Modal } from '../components/ui'
import { parseDeadline } from '../lib/dates'
import { clearDraft, loadDraft, parkedProjectDraft, saveDraft, summarizeProjectDraft } from '../lib/drafts'
import { hashParam, projectIdFromHash } from '../lib/route'
import {
  bar,
  commanderBrief,
  currentMilestone,
  daysLeft,
  daysSince,
  healthOf,
  isNextUp,
  isWorkingOn,
  labelHealth,
  labelState,
  labelVelocity,
  migrateProjectFocusLimit,
  nextMilestone,
  pendingDecisions,
  portfolioIntel,
  velocityOf,
} from '../lib/project-engine'
import type { Project, ProjectBlocker, ProjectDecision, ProjectMilestone } from '../lib/types'
import { useStore } from '../store'
import { ProjectDetail } from './ProjectDetail'

type Filter = 'all' | 'working' | 'next' | 'at_risk' | 'blocked' | 'complete'
type ProjectCardModel = {
  p: Project
  ms: ProjectMilestone[]
  bl: ProjectBlocker[]
  ds: ProjectDecision[]
  health: ReturnType<typeof healthOf>
  vel: ReturnType<typeof velocityOf>
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'working', label: 'Working on' },
  { id: 'next', label: 'Next' },
  { id: 'at_risk', label: 'At risk' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'complete', label: 'Complete' },
]

export function Projects() {
  const { state, addProject, addMilestones, updateProject } = useStore()
  const [filter, setFilter] = useState<Filter>('all')
  const [company, setCompany] = useState('all')
  const [owner, setOwner] = useState('all')
  const [healthF, setHealthF] = useState('all')
  const [deadlineF, setDeadlineF] = useState('all')
  const [openId, setOpenId] = useState<string | null>(projectIdFromHash())
  const [creating, setCreating] = useState(() => location.hash.includes('new=1'))
  const [capWarn, setCapWarn] = useState(false)
  const [capTarget, setCapTarget] = useState<string | null>(null)
  const [overrideCap, setOverrideCap] = useState(false)
  const [intel, setIntel] = useState(false)
  const ownerDefault = state.settings.name || 'Kens'
  const [parked, setParked] = useState(() => parkedProjectDraft(ownerDefault))

  useEffect(() => {
    const on = () => {
      setOpenId(projectIdFromHash())
      setCreating(location.hash.includes('new=1'))
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  useEffect(() => {
    if (!creating) setParked(parkedProjectDraft(ownerDefault))
  }, [creating, ownerDefault])

  const live = state.projects.filter((p) => p.state !== 'archived')
  const companies = [...new Set(live.map((p) => p.company).filter(Boolean))]

  const cards = useMemo(() => {
    return live
      .map((p) => {
        const ms = state.milestones.filter((m) => m.projectId === p.id)
        const bl = state.blockers.filter((b) => b.projectId === p.id && !b.resolvedAt)
        const ds = state.projectDecisions.filter((d) => d.projectId === p.id)
        const health = healthOf(p, ms, bl, ds)
        const vel = velocityOf(p, ms, bl, ds)
        return { p, ms, bl, ds, health, vel }
      })
      .filter((c) => {
        if (company !== 'all' && c.p.company !== company) return false
        if (owner !== 'all' && c.p.owner !== owner) return false
        if (healthF !== 'all' && c.health !== healthF) return false
        if (deadlineF === 'week' && !(daysLeft(c.p.deadline) >= 0 && daysLeft(c.p.deadline) <= 7)) return false
        if (deadlineF === 'overdue' && daysLeft(c.p.deadline) < 0) return false
        if (filter === 'all') return c.p.state !== 'complete'
        if (filter === 'working') return isWorkingOn(c.p)
        if (filter === 'next') return isNextUp(c.p)
        if (filter === 'at_risk') return c.health === 'at_risk' || c.health === 'critical'
        if (filter === 'blocked') return c.p.state === 'blocked' || c.health === 'blocked'
        if (filter === 'complete') return c.p.state === 'complete'
        return true
      })
  }, [company, deadlineF, filter, healthF, live, owner, state.blockers, state.milestones, state.projectDecisions])

  const working = live.filter(isWorkingOn)
  const queued = live.filter(isNextUp)
  const active = working.filter((p) => p.state === 'active')
  const scored = live.map((p) => {
    const ms = state.milestones.filter((m) => m.projectId === p.id)
    const bl = state.blockers.filter((b) => b.projectId === p.id && !b.resolvedAt)
    const ds = state.projectDecisions.filter((d) => d.projectId === p.id)
    return { p, health: healthOf(p, ms, bl, ds) }
  })
  const atRisk = scored.filter((c) => c.health === 'at_risk' || c.health === 'critical').length
  const blockedN = live.filter((p) => p.state === 'blocked').length
  const pending = pendingDecisions(state.projectDecisions)
  const decN = pending.length
  const limit = migrateProjectFocusLimit(state.settings.activeProjectLimit)
  const owners = [...new Set(live.map((p) => p.owner).filter(Boolean))]
  const port = portfolioIntel(state)
  const attn = live
    .flatMap((p) => {
      const ms = state.milestones.filter((m) => m.projectId === p.id)
      const bl = state.blockers.filter((b) => b.projectId === p.id && !b.resolvedAt)
      const ds = state.projectDecisions.filter((d) => d.projectId === p.id)
      const h = healthOf(p, ms, bl, ds)
      const items: { id: string; projectId: string; title: string; detail: string }[] = []
      if (h === 'critical' || h === 'at_risk') items.push({ id: p.id + '-h', projectId: p.id, title: p.name, detail: labelHealth(h) })
      for (const b of bl.filter((x) => x.isPrimary)) items.push({ id: b.id, projectId: p.id, title: p.name, detail: `${b.title} · ${daysSince(b.startedAt)}d` })
      return items
    })
    .slice(0, 6)
  const commander = (() => {
    const first = live.find((p) => p.name.includes('Truck')) ?? active[0]
    if (!first) return 'Nothing in Working on. Pull a Next project in, or create one.'
    if (port.dueToday) return `${port.dueToday} executive decision${port.dueToday === 1 ? '' : 's'} require you today.`
    if (port.atRisk) return `${port.atRisk} project${port.atRisk === 1 ? '' : 's'} slipping. Clear bottlenecks before adding work.`
    return commanderBrief({
      project: first,
      milestones: state.milestones.filter((m) => m.projectId === first.id),
      blockers: state.blockers.filter((b) => b.projectId === first.id),
      decisions: state.projectDecisions.filter((d) => d.projectId === first.id),
      waiting: state.waitingOnItems.filter((w) => w.projectId === first.id),
    }).text
  })()

  useEffect(() => {
    if (!openId || !state.projects.length) return
    if (!state.projects.some((p) => p.id === openId)) location.hash = '#/projects'
  }, [openId, state.projects])

  if (openId) {
    const p = state.projects.find((x) => x.id === openId)
    if (p) return <ProjectDetail project={p} onBack={() => { location.hash = '#/projects' }} />
  }

  return (
    <div>
      <header className="page-head page-head-route">
        <div>
          <p className="kicker">Projects // Command center</p>
          <h1>Projects</h1>
        </div>
        <button className="btn" onClick={() => setCreating(true)}>
          {parked ? 'Resume project draft' : '+ New project'}
        </button>
      </header>

      {parked ? (
        <section className="hud-frame" style={{ padding: 14, marginBottom: 16 }}>
          <p className="kicker">Saved for later</p>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>{parked.name}</strong>
              <p className="muted">Continue this project when you are ready.</p>
            </div>
            <div className="row">
              <button
                className="btn-ghost"
                onClick={() => {
                  clearDraft('project')
                  setParked(null)
                }}
              >
                Discard
              </button>
              <button className="btn" onClick={() => setCreating(true)}>
                Continue
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <div className="proj-metrics">
        <Metric n={working.length} l="Working on" />
        <Metric n={queued.length} l="Next" />
        <Metric n={atRisk} l="At risk" warn />
        <Metric n={blockedN} l="Blocked" warn />
        <Metric n={decN} l="Decisions" />
      </div>

      <div className="proj-cap">
        <span className="kicker">Working on</span>
        <b>
          {working.length} / {limit}
        </b>
        <span className="proj-bar">{bar((working.length / Math.max(1, limit)) * 100)}</span>
        {working.length > limit ? <span className="muted">Move extras to Next to keep the deck at {limit}.</span> : null}
      </div>

      <div className="proj-cc">
        <div>
          <div className="row chip-rail" style={{ marginBottom: 14 }}>
            {FILTERS.map((f) => (
              <button key={f.id} className="chip" data-on={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
            <select className="select" style={{ width: 'auto' }} value={company} onChange={(e) => setCompany(e.target.value)}>
              <option value="all">All companies</option>
              {companies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select className="select" style={{ width: 'auto' }} value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="all">All owners</option>
              {owners.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <select className="select" style={{ width: 'auto' }} value={healthF} onChange={(e) => setHealthF(e.target.value)}>
              <option value="all">All health</option>
              <option value="on_track">On track</option>
              <option value="at_risk">At risk</option>
              <option value="critical">Critical</option>
              <option value="blocked">Blocked</option>
            </select>
            <select className="select" style={{ width: 'auto' }} value={deadlineF} onChange={(e) => setDeadlineF(e.target.value)}>
              <option value="all">Any deadline</option>
              <option value="week">Due this week</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>

          {live.length === 0 ? (
            <div className="hud-frame empty">
              <p className="kicker">Project system online</p>
              <h3>No projects yet</h3>
              <p className="muted">Keep three in Working on. Everything else waits in Next.</p>
              <button className="btn" onClick={() => setCreating(true)}>
                {parked ? 'Resume project draft' : 'Create first project'}
              </button>
            </div>
          ) : cards.length === 0 ? (
            <div className="hud-frame empty">
              <p className="kicker">Filters engaged</p>
              <h3>No matching projects</h3>
            </div>
          ) : filter === 'all' ? (
            <>
              <Lane
                title="Working on"
                count={`${cards.filter((c) => isWorkingOn(c.p)).length} / ${limit}`}
                empty="Nothing in motion. Pull a Next project in, or create one."
                cards={cards.filter((c) => isWorkingOn(c.p))}
                onMoveNext={(id) => updateProject(id, { state: 'backlog' })}
                onWorkNow={(id) => {
                  const result = updateProject(id, { state: 'active' })
                  if (result && result.error === 'capacity') {
                    setCapTarget(id)
                    setCapWarn(true)
                  }
                }}
              />
              <Lane
                title="Next"
                count={String(cards.filter((c) => isNextUp(c.p)).length)}
                empty="Queue is clear. New work you are not running yet lands here."
                cards={cards.filter((c) => isNextUp(c.p))}
                onMoveNext={(id) => updateProject(id, { state: 'backlog' })}
                onWorkNow={(id) => {
                  const result = updateProject(id, { state: 'active' })
                  if (result && result.error === 'capacity') {
                    setCapTarget(id)
                    setCapWarn(true)
                  }
                }}
              />
            </>
          ) : (
            <div className="proj-grid">
              {cards.map((c) => (
                <ProjectCard
                  key={c.p.id}
                  card={c}
                  onMoveNext={() => updateProject(c.p.id, { state: 'backlog' })}
                  onWorkNow={() => {
                    const result = updateProject(c.p.id, { state: 'active' })
                    if (result && result.error === 'capacity') {
                      setCapTarget(c.p.id)
                      setCapWarn(true)
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <aside className="stack proj-rail">
          <section className="hud-frame" style={{ padding: 14 }}>
            <p className="board-label warn">Needs attention</p>
            {attn.length === 0 ? <p className="today-empty">No critical items. System clear.</p> : null}
            {attn.map((a) => (
              <button key={a.id} className="board-line" onClick={() => { location.hash = `#/projects/${a.projectId}` }}>
                {a.title} — {a.detail}
              </button>
            ))}
          </section>
          <section className="hud-frame" style={{ padding: 14 }}>
            <p className="board-label">Decision queue</p>
            {pending.length === 0 ? <p className="today-empty">No executive decisions waiting. System clear.</p> : null}
            {pending.slice(0, 6).map((d) => (
              <button key={d.id} className="board-line" onClick={() => { location.hash = `#/projects/${d.projectId}` }}>
                {d.title}
                <span className="muted"> {d.deadline ?? ''}</span>
              </button>
            ))}
          </section>
          <section className="hud-frame" style={{ padding: 14 }}>
            <p className="board-label">Portfolio velocity</p>
            <p>{labelVelocity(port.mark)}</p>
            <p className="muted">Latency {port.latency}d · Blockers {port.avgBlock}d · Stale {port.stale}</p>
            <button className="btn-ghost" onClick={() => setIntel((v) => !v)}>
              {intel ? 'Hide' : 'View'} portfolio intelligence
            </button>
            {intel ? (
              <div className="muted" style={{ marginTop: 8 }}>
                <p>Completed this month {port.completedMonth}</p>
                <p>Upcoming deadlines {port.week}</p>
                <p>Owner load {Object.entries(port.owners).map(([k, v]) => `${k} ${v}`).join(' · ') || '—'}</p>
              </div>
            ) : null}
          </section>
          <section className="hud-frame" style={{ padding: 14 }}>
            <p className="board-label">Sepho // Command</p>
            <p className="board-brief">{commander}</p>
          </section>
        </aside>
      </div>

      {creating ? (
        <CreateProject
          onClose={() => {
            setCreating(false)
            if (location.hash.includes('new=1')) location.hash = '#/projects'
          }}
          onCreate={(id) => {
            setCreating(false)
            location.hash = `#/projects/${id}`
          }}
          addProject={addProject}
          addMilestones={addMilestones}
          ownerDefault={ownerDefault}
          goals={state.goals}
          overrideCapacity={overrideCap}
          workingFull={working.length >= limit}
          limit={limit}
        />
      ) : null}

      {capWarn ? (
        <Modal
          title="Working on is full"
          onClose={() => {
            setCapWarn(false)
            setCapTarget(null)
          }}
        >
          <p className="muted">
            You already have {working.length} projects in Working on (limit {limit}). Move one to Next before pulling another in.
          </p>
          <div className="stack" style={{ marginTop: 12 }}>
            {working.map((p) => (
              <div key={p.id} className="row" style={{ justifyContent: 'space-between' }}>
                <span>{p.name}</span>
                <button
                  className="btn-ghost"
                  onClick={() => {
                    updateProject(p.id, { state: 'backlog' })
                    if (capTarget) {
                      updateProject(capTarget, { state: 'active' })
                      setCapTarget(null)
                      setCapWarn(false)
                    }
                  }}
                >
                  Move to next
                </button>
              </div>
            ))}
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12, flexWrap: 'wrap' }}>
            <button
              className="btn-ghost"
              onClick={() => {
                setCapWarn(false)
                setCapTarget(null)
              }}
            >
              Cancel
            </button>
            <button
              className="btn-ghost"
              onClick={() => {
                setCapWarn(false)
                setCapTarget(null)
                if (working[0]) location.hash = `#/projects/${working[0].id}`
              }}
            >
              Complete a project
            </button>
            <button
              className="btn"
              onClick={() => {
                if (!confirm('Override the 3-project focus? This loads more onto the command deck.')) return
                setOverrideCap(true)
                setCapWarn(false)
                if (capTarget) {
                  updateProject(capTarget, { state: 'active' }, { overrideCapacity: true })
                  setCapTarget(null)
                } else {
                  setCreating(true)
                }
              }}
            >
              Override
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}

function Metric({ n, l, warn }: { n: number; l: string; warn?: boolean }) {
  return (
    <div className="hud-frame proj-metric">
      <b className={warn ? 'warn' : undefined}>{n}</b>
      <span className="kicker">{l}</span>
    </div>
  )
}

function Lane({
  title,
  count,
  empty,
  cards,
  onMoveNext,
  onWorkNow,
}: {
  title: string
  count: string
  empty: string
  cards: ProjectCardModel[]
  onMoveNext: (id: string) => void
  onWorkNow: (id: string) => void
}) {
  return (
    <section className="proj-lane">
      <div className="proj-lane-head">
        <p className="board-label">{title}</p>
        <span className="muted">{count}</span>
      </div>
      {cards.length === 0 ? <p className="muted">{empty}</p> : null}
      {cards.length ? (
        <div className="proj-grid">
          {cards.map((c) => (
            <ProjectCard key={c.p.id} card={c} onMoveNext={() => onMoveNext(c.p.id)} onWorkNow={() => onWorkNow(c.p.id)} />
          ))}
        </div>
      ) : null}
    </section>
  )
}

function ProjectCard({
  card: c,
  onMoveNext,
  onWorkNow,
}: {
  card: ProjectCardModel
  onMoveNext: () => void
  onWorkNow: () => void
}) {
  const cur = currentMilestone(c.ms)
  const nxt = nextMilestone(c.ms)
  const block = c.bl.find((b) => b.isPrimary && !b.resolvedAt) ?? c.bl.find((b) => !b.resolvedAt)
  const nextD = pendingDecisions(c.ds)[0]
  const left = daysLeft(c.p.deadline)
  return (
    <article
      className="hud-frame proj-card"
      onClick={() => {
        location.hash = `#/projects/${c.p.id}`
      }}
    >
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3>{c.p.name}</h3>
        <span className={`health health-${c.health}`}>{labelHealth(c.health)}</span>
      </div>
      <p className="kicker">{c.p.company}</p>
      <p className="muted">
        {labelState(c.p.state)} // {labelHealth(c.health)} · Owner {c.p.owner}
      </p>
      <p className="muted">
        Deadline {c.p.deadline} · {left} days left · {labelVelocity(c.vel.mark)}
      </p>
      <p className="proj-bar">
        {bar(c.vel.actual)} {c.vel.actual}%
      </p>
      <p>
        <span className="kicker">Current</span> {cur?.name ?? '—'}
      </p>
      <p>
        <span className="kicker">Bottleneck</span> {block ? `${block.title} · ${daysSince(block.startedAt)}d` : 'Clear'}
      </p>
      <p>
        <span className="kicker">Next decision</span> {nextD?.title ?? '—'}
      </p>
      <p>
        <span className="kicker">Next milestone</span> {nxt?.name ?? '—'}
      </p>
      <div className="row proj-card-acts">
        <button
          className="btn-ghost"
          onClick={(e) => {
            e.stopPropagation()
            location.hash = `#/projects/${c.p.id}`
          }}
        >
          Open project
        </button>
        {isWorkingOn(c.p) && c.p.state !== 'complete' ? (
          <button
            className="btn-ghost"
            onClick={(e) => {
              e.stopPropagation()
              onMoveNext()
            }}
          >
            Move to next
          </button>
        ) : null}
        {isNextUp(c.p) ? (
          <button
            className="btn-ghost"
            onClick={(e) => {
              e.stopPropagation()
              onWorkNow()
            }}
          >
            Work on now
          </button>
        ) : null}
      </div>
    </article>
  )
}

function CreateProject({
  onClose,
  onCreate,
  addProject,
  addMilestones,
  ownerDefault,
  goals,
  overrideCapacity,
  workingFull,
  limit,
}: {
  onClose: () => void
  onCreate: (id: string) => void
  addProject: ReturnType<typeof useStore>['addProject']
  addMilestones: ReturnType<typeof useStore>['addMilestones']
  ownerDefault: string
  goals: { id: string; title: string }[]
  overrideCapacity?: boolean
  workingFull?: boolean
  limit?: number
}) {
  const [form, setForm] = useState(() => {
    const blank = {
      name: '',
      company: '',
      owner: ownerDefault,
      deadline: '',
      objective: '',
      definitionOfDone: '',
      successMetric: '',
      why: '',
      constraints: '',
      problem: '',
      desiredOutcome: '',
      assumptions: '',
      killPivot: '',
      goalId: '',
    }
    const saved = loadDraft<{ form: typeof blank }>('project')?.form
    const fromGoal = hashParam('goal') || ''
    const merged = saved ? { ...blank, ...saved, owner: saved.owner || ownerDefault } : blank
    return { ...merged, goalId: fromGoal || merged.goalId }
  })
  const [steps, setSteps] = useState(() => {
    const raw = loadDraft<{ steps: { name: string; date: string; todos?: string[] }[] }>('project')?.steps
    const rows = raw?.length ? raw : [{ name: '', date: '' }, { name: '', date: '' }]
    return rows.map((s) => ({ name: s.name, date: s.date, todos: s.todos ?? [] }))
  })
  const [missing, setMissing] = useState<string[]>([])
  const [resuming] = useState(() => Boolean(parkedProjectDraft(ownerDefault)))
  useEffect(() => {
    const t = window.setTimeout(() => saveDraft('project', { form, steps }), 200)
    return () => window.clearTimeout(t)
  }, [form, steps])
  const park = () => {
    if (summarizeProjectDraft({ form, steps }, ownerDefault)) saveDraft('project', { form, steps })
    else clearDraft('project')
    onClose()
  }
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))
  const bind = (k: keyof typeof form) => ({
    name: k,
    value: form[k],
    onChange: (e: { target: { value: string } }) => set(k, e.target.value),
    onInput: (e: { currentTarget: { value: string } }) => set(k, e.currentTarget.value),
  })
  const save = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const read = (k: keyof typeof form) => {
      const fromDom = String(fd.get(k) ?? '')
      const fromState = form[k]
      return (fromDom || fromState).trim()
    }
    const name = read('name')
    const owner = read('owner')
    const deadline = parseDeadline(read('deadline'))
    const objective = read('objective')
    const definitionOfDone = read('definitionOfDone')
    const successMetric = read('successMetric')
    const pathSteps = steps
      .map((s) => ({
        name: s.name.trim(),
        plannedEnd: parseDeadline(s.date),
        todos: s.todos.map((t) => t.trim()).filter(Boolean),
      }))
      .filter((s) => s.name)
    const blank = [
      !name && 'Project name',
      !owner && 'Accountable owner',
      !deadline && 'Deadline',
      !objective && 'Objective',
      !definitionOfDone && 'Definition of done',
      !successMetric && 'Success metric',
      !pathSteps.length && 'Critical path (at least one milestone)',
      pathSteps.some((s) => !s.plannedEnd) && 'Accomplishment date on every step',
    ].filter(Boolean) as string[]
    if (blank.length) {
      setMissing(blank)
      const first = e.currentTarget.elements.namedItem(
        blank[0] === 'Project name'
          ? 'name'
          : blank[0] === 'Accountable owner'
            ? 'owner'
            : blank[0] === 'Deadline'
              ? 'deadline'
              : blank[0] === 'Objective'
                ? 'objective'
                : blank[0] === 'Definition of done'
                  ? 'definitionOfDone'
                  : 'successMetric',
      )
      if (first instanceof HTMLElement) first.focus()
      return
    }
    setMissing([])
    const result = addProject({
      name,
      company: read('company'),
      owner,
      deadline,
      objective,
      definitionOfDone,
      successMetric,
      why: read('why'),
      constraints: read('constraints'),
      problem: read('problem'),
      desiredOutcome: read('desiredOutcome'),
      assumptions: read('assumptions'),
      killPivot: read('killPivot'),
      goalId: read('goalId') || undefined,
      state: overrideCapacity || !workingFull ? 'active' : 'backlog',
    }, { overrideCapacity })
    if (typeof result !== 'string') {
      setMissing(['Working on is full. Move a project to Next first.'])
      return
    }
    addMilestones(result, pathSteps)
    clearDraft('project')
    onCreate(result)
  }
  return (
    <Modal title="New project" onClose={onClose} wide persist>
      <form className="stack" onSubmit={save}>
        <p className="muted">
          {resuming ? 'Resuming saved draft. ' : ''}
          {workingFull && !overrideCapacity
            ? `Working on is full (${limit}/${limit}). This project will land in Next.`
            : 'Save and continue later keeps this on Projects. Create when the required fields are ready.'}
        </p>
        {missing.length ? (
          <p className="gate-error" role="alert">
            Still needed: {missing.join(', ')}
          </p>
        ) : null}
        <Field label="Project name *">
          <input className="input" required autoComplete="off" {...bind('name')} />
        </Field>
        <div className="grid-2">
          <Field label="Company / area">
            <input className="input" autoComplete="off" {...bind('company')} />
          </Field>
          <Field label="Accountable owner *">
            <input className="input" required autoComplete="name" {...bind('owner')} />
          </Field>
        </div>
        <Field label="Deadline *">
          <DateField name="deadline" value={form.deadline} onChange={(v) => set('deadline', v)} aria-label="Deadline" />
        </Field>
        <Field label="Objective *">
          <textarea className="textarea" required {...bind('objective')} />
        </Field>
        <Field label="Definition of done *">
          <textarea className="textarea" required {...bind('definitionOfDone')} />
        </Field>
        <Field label="Success metric *">
          <input className="input" required autoComplete="off" {...bind('successMetric')} />
        </Field>
        <Field label="Critical path *">
          <span className="muted">Each step needs a name and an accomplishment date. Add to-dos under a step if you want extra work on it.</span>
          <div className="cpath-editor">
            {steps.map((step, i) => (
              <div key={i} className="cpath-edit-block">
                <div className="cpath-edit-row">
                  <span className="cpath-mark">{i === 0 ? '●' : '○'}</span>
                  <input
                    className="input"
                    placeholder={i === 0 ? 'Secure Financing' : 'Next milestone'}
                    value={step.name}
                    onChange={(e) => setSteps((rows) => rows.map((r, n) => (n === i ? { ...r, name: e.target.value } : r)))}
                  />
                  <DateField
                    aria-label={`Accomplishment date for step ${i + 1}`}
                    value={step.date}
                    onChange={(date) => setSteps((rows) => rows.map((r, n) => (n === i ? { ...r, date } : r)))}
                  />
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() =>
                      setSteps((rows) => (rows.length === 1 ? [{ name: '', date: '', todos: [] }] : rows.filter((_, n) => n !== i)))
                    }
                  >
                    ×
                  </button>
                </div>
                {step.todos.map((todo, ti) => (
                  <div key={ti} className="cpath-edit-todo">
                    <input
                      className="input"
                      placeholder="To-do under this step"
                      value={todo}
                      onChange={(e) =>
                        setSteps((rows) =>
                          rows.map((r, n) =>
                            n === i ? { ...r, todos: r.todos.map((t, k) => (k === ti ? e.target.value : t)) } : r,
                          ),
                        )
                      }
                    />
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() =>
                        setSteps((rows) => rows.map((r, n) => (n === i ? { ...r, todos: r.todos.filter((_, k) => k !== ti) } : r)))
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setSteps((rows) => rows.map((r, n) => (n === i ? { ...r, todos: [...r.todos, ''] } : r)))}
                >
                  + Add a to-do under this step
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn-ghost" onClick={() => setSteps((rows) => [...rows, { name: '', date: '', todos: [] }])}>
            + Add step
          </button>
        </Field>
        <Field label="Why this exists">
          <textarea className="textarea" {...bind('why')} />
        </Field>
        <p className="kicker">First principles</p>
        <Field label="Problem">
          <textarea className="textarea" {...bind('problem')} />
        </Field>
        <Field label="Desired outcome">
          <textarea className="textarea" {...bind('desiredOutcome')} />
        </Field>
        <Field label="Non-negotiable constraints">
          <textarea className="textarea" {...bind('constraints')} />
        </Field>
        <Field label="Assumptions">
          <textarea className="textarea" {...bind('assumptions')} />
        </Field>
        <Field label="Kill / pivot condition">
          <textarea className="textarea" {...bind('killPivot')} />
        </Field>
        <Field label="Linked goal">
          <select className="select" {...bind('goalId')}>
            <option value="">None</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </Field>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn-ghost" type="button" onClick={park}>
            Save and continue later
          </button>
          <button className="btn" type="submit">
            Create project
          </button>
        </div>
      </form>
    </Modal>
  )
}

