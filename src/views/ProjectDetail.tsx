import { useState } from 'react'
import { Field, Modal } from '../components/ui'
import { formatShort, todayISO } from '../lib/dates'
import {
  bar,
  commanderBrief,
  currentMilestone,
  daysLeft,
  daysSince,
  depsReady,
  healthOf,
  labelHealth,
  labelState,
  labelVelocity,
  parseMilestoneLines,
  pendingDecisions,
  primaryBlocker,
  progressOf,
  projectedCompletion,
  velocityOf,
} from '../lib/project-engine'
import type { Project } from '../lib/types'
import { useStore } from '../store'

export function ProjectDetail({ project, onBack }: { project: Project; onBack: () => void }) {
  const store = useStore()
  const { state } = store
  const ms = state.milestones.filter((m) => m.projectId === project.id).sort((a, b) => a.sortOrder - b.sortOrder)
  const bl = state.blockers.filter((b) => b.projectId === project.id)
  const ds = state.projectDecisions.filter((d) => d.projectId === project.id)
  const ws = state.workstreams.filter((w) => w.projectId === project.id)
  const waiting = state.waitingOnItems.filter((w) => w.projectId === project.id && w.status !== 'received' && w.status !== 'cancelled')
  const tasks = state.tasks.filter((t) => t.projectId === project.id)
  const notes = state.notes.filter((n) => n.projectId === project.id)
  const sessions = state.sessions.filter((s) => s.projectId === project.id)
  const events = state.events.filter((e) => tasks.some((t) => t.eventId === e.id) || e.notes.includes(project.id))
  const activity = state.projectActivity.filter((a) => a.projectId === project.id).slice(0, 20)
  const health = healthOf(project, ms, bl, ds)
  const vel = velocityOf(project, ms, bl, ds)
  const cur = currentMilestone(ms)
  const block = primaryBlocker(bl.filter((b) => !b.resolvedAt))
  const brief = commanderBrief({ project, milestones: ms, blockers: bl, decisions: ds, waiting })
  const [principles, setPrinciples] = useState(false)
  const [plan, setPlan] = useState(false)
  const [complete, setComplete] = useState(false)
  const [addMs, setAddMs] = useState('')
  const [addDate, setAddDate] = useState('')
  const [decTitle, setDecTitle] = useState('')
  const [waitPerson, setWaitPerson] = useState('')
  const [waitWhat, setWaitWhat] = useState('')
  const [blockTitle, setBlockTitle] = useState('')
  const [outcome, setOutcome] = useState('')
  const [lessons, setLessons] = useState('')
  const [wsOpen, setWsOpen] = useState<string | null>(null)
  const [ask, setAsk] = useState('')

  const path = ms.filter((m) => m.criticalPath).length ? ms.filter((m) => m.criticalPath) : ms
  const variance = vel.variance
  const projected = projectedCompletion(project.deadline, variance)

  return (
    <div>
      <button className="btn-ghost" onClick={onBack}>
        ← Command center
      </button>
      <header className="page-head">
        <div>
          <p className="kicker">
            Project // {project.company}
          </p>
          <h1>{project.name}</h1>
          <p className="muted">
            {labelState(project.state)} // {labelHealth(health)} · Owner {project.owner} · Deadline {project.deadline} · {daysLeft(project.deadline)} days left
          </p>
        </div>
        <div className="row">
          {project.state === 'active' ? (
            <button className="btn-ghost" onClick={() => store.updateProject(project.id, { state: 'backlog' })}>
              Pause
            </button>
          ) : null}
          {project.state === 'backlog' ? (
            <button className="btn-ghost" onClick={() => store.updateProject(project.id, { state: 'active' })}>
              Activate
            </button>
          ) : null}
          {project.state !== 'complete' ? (
            <button className="btn-ghost" onClick={() => setComplete(true)}>
              Complete
            </button>
          ) : null}
        </div>
      </header>

      <div className="proj-detail">
        <div className="stack">
          <section className="hud-frame" style={{ padding: 16 }}>
            <p className="kicker">Objective</p>
            <p>{project.objective}</p>
            <p className="muted">Done when: {project.definitionOfDone}</p>
            <p className="muted">Metric: {project.successMetric}</p>
          </section>

          <section className="hud-frame" style={{ padding: 16 }}>
            <p className="board-label">Current command</p>
            <p className="now-star">★ {cur?.name ?? 'No current milestone'}</p>
            <p>
              <span className="kicker">#1 Bottleneck</span> {block ? block.title : 'None'}
            </p>
            {block ? (
              <p className="muted">
                Owner {block.owner} · Age {daysSince(block.startedAt)}d · Impact {block.delayDays}d
                {block.expectedResolution ? ` · Expected ${block.expectedResolution}` : ''}
              </p>
            ) : null}
            <div className="row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
              {block ? (
                <>
                  <button className="btn" onClick={() => store.resolveBlocker(block.id)}>
                    Resolve
                  </button>
                  <button className="btn-ghost" onClick={() => store.updateProject(project.id, { state: 'blocked' })}>
                    Escalate
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={() => {
                      const who = prompt('Assign bottleneck owner', block.owner)
                      if (who?.trim()) store.updateBlocker(block.id, { owner: who.trim() })
                    }}
                  >
                    Assign
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={() => {
                      const ctx = prompt('Add context', block.description)
                      if (ctx != null) store.updateBlocker(block.id, { description: ctx })
                    }}
                  >
                    Add context
                  </button>
                </>
              ) : null}
            </div>
          </section>

          <section className="hud-frame cpath-panel" style={{ padding: 16 }}>
            <p className="board-label">Critical path</p>
            <p className="muted">
              Variance {variance ? `-${variance} days` : '0'} · Projected {projected} · Original {project.deadline}
            </p>
            {path.length === 0 ? (
              <div className="cpath-empty">
                <p className="kicker">No sequence defined</p>
                <p>The critical path is the ordered chain of outcomes that must complete for this project to finish.</p>
              </div>
            ) : (
              <ol className="cpath">
                {path.map((m, i) => (
                  <li key={m.id} className={`cpath-${m.status}`}>
                    <span className="cpath-mark">{m.status === 'complete' ? '✓' : m.status === 'current' || m.status === 'blocked' ? '●' : '○'}</span>
                    <div>
                      <strong>{m.name}</strong>
                      <span className="muted"> {m.owner}{m.dependsOn.length ? ` · waits on ${m.dependsOn.length}` : ''}{!depsReady(m, ms) && m.status !== 'complete' ? ' · deps open' : ''}</span>
                      <div className="cpath-dates">
                        <label className="cpath-date">
                          <span className="kicker">{m.status === 'complete' ? 'Planned' : 'Accomplish by'}</span>
                          <input
                            className="input"
                            type="date"
                            value={m.plannedEnd ?? ''}
                            onChange={(e) => store.updateMilestone(m.id, { plannedEnd: e.target.value || undefined })}
                          />
                          {m.plannedEnd && m.status !== 'complete' && m.plannedEnd < todayISO() ? (
                            <span className="health health-critical">LATE</span>
                          ) : m.plannedEnd ? (
                            <span className="muted">{formatShort(m.plannedEnd)}</span>
                          ) : null}
                        </label>
                        {m.status === 'complete' ? (
                          <label className="cpath-date">
                            <span className="kicker">Accomplished</span>
                            <input
                              className="input"
                              type="date"
                              value={m.actualEnd ?? ''}
                              onChange={(e) => store.updateMilestone(m.id, { actualEnd: e.target.value || undefined })}
                            />
                          </label>
                        ) : null}
                      </div>
                      {m.status !== 'complete' && project.state !== 'complete' ? (
                        <button className="chip" onClick={() => store.updateMilestone(m.id, { status: 'complete', actualEnd: todayISO() })}>
                          Mark complete
                        </button>
                      ) : null}
                      {ms.length > 1 && m.status !== 'complete' ? (
                        <select
                          className="select"
                          style={{ width: 'auto', marginTop: 4 }}
                          value=""
                          onChange={(e) => {
                            const dep = e.target.value
                            if (!dep) return
                            const next = m.dependsOn.includes(dep) ? m.dependsOn.filter((d) => d !== dep) : [...m.dependsOn, dep]
                            store.updateMilestone(m.id, { dependsOn: next })
                          }}
                        >
                          <option value="">Depends on…</option>
                          {ms.filter((x) => x.id !== m.id).map((x) => (
                            <option key={x.id} value={x.id}>
                              {m.dependsOn.includes(x.id) ? '✓ ' : ''}
                              {x.name}
                            </option>
                          ))}
                        </select>
                      ) : null}
                    </div>
                    {i < path.length - 1 ? <div className="cpath-line">↓</div> : null}
                  </li>
                ))}
              </ol>
            )}
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault()
                const parsed = parseMilestoneLines(addMs)
                const steps = parsed.length
                  ? parsed.map((s) => ({ name: s.name, plannedEnd: s.plannedEnd || addDate || undefined }))
                  : addMs.trim()
                    ? [{ name: addMs.trim(), plannedEnd: addDate || undefined }]
                    : []
                if (!steps.length) return
                if (steps.some((s) => !s.plannedEnd)) {
                  alert('Each critical path step needs an accomplishment date.')
                  return
                }
                store.addMilestones(project.id, steps)
                setAddMs('')
                setAddDate('')
              }}
            >
              <div className="cpath-edit-row is-add">
                <input className="input" value={addMs} onChange={(e) => setAddMs(e.target.value)} placeholder={path.length ? 'Next milestone' : 'Secure Financing'} />
                <input className="input" type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} aria-label="Accomplishment date" />
              </div>
              <p className="muted">Paste several lines as Name — YYYY-MM-DD if you want to add a chain at once.</p>
              <button className="btn" type="submit">
                {path.length ? 'Add to path' : 'Build critical path'}
              </button>
            </form>
          </section>

          {ws.length ? (
            <section className="hud-frame" style={{ padding: 16 }}>
              <p className="board-label">Workstreams</p>
              {ws.map((w) => {
                const wms = ms.filter((m) => m.workstreamId === w.id)
                const wtasks = tasks.filter((t) => t.workstreamId === w.id)
                const open = wsOpen === w.id
                return (
                  <button key={w.id} className="board-line" onClick={() => setWsOpen(open ? null : w.id)}>
                    <strong>{w.name}</strong>{' '}
                    <span className="muted">
                      {w.owner} · {progressOf(wms.length ? wms : [])}% · {wtasks.filter((t) => !t.completed).length} open
                    </span>
                    {open ? (
                      <span className="muted" style={{ display: 'block' }}>
                        {wms.map((m) => m.name).join(' · ') || 'No milestones tagged'}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </section>
          ) : null}

          <section className="hud-frame" style={{ padding: 16 }}>
            <p className="board-label">Linked execution</p>
            <div className="row">
              <button className="chip" onClick={() => { location.hash = `#/tasks?project=${project.id}` }}>
                Tasks {tasks.filter((t) => !t.completed).length} open
              </button>
              <button className="chip" onClick={() => { location.hash = `#/calendar?project=${project.id}` }}>
                Calendar {events.length}
              </button>
              <button className="chip" onClick={() => { location.hash = `#/notes?project=${project.id}` }}>
                Notes {notes.length}
              </button>
              <button className="chip" onClick={() => { location.hash = `#/focus?project=${project.id}` }}>
                Focus {Math.round(sessions.filter((s) => s.mode === 'focus').reduce((n, s) => n + s.seconds, 0) / 60)}m
              </button>
            </div>
            <form
              className="row"
              style={{ marginTop: 10 }}
              onSubmit={(e) => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                const title = String(fd.get('t') ?? '').trim()
                if (!title) return
                store.addTask({ title, projectId: project.id, milestoneId: cur?.id, due: todayISO() })
                e.currentTarget.reset()
              }}
            >
              <input className="input" name="t" placeholder="Link a task to this project" />
            </form>
          </section>

          <section className="hud-frame" style={{ padding: 16 }}>
            <button className="board-label as-btn" onClick={() => setPrinciples((v) => !v)}>
              First principles {principles ? '−' : '+'}
            </button>
            {principles ? (
              <div className="stack">
                <p><span className="kicker">Problem</span> {project.problem || '—'}</p>
                <p><span className="kicker">Desired outcome</span> {project.desiredOutcome || '—'}</p>
                <p><span className="kicker">Constraints</span> {project.constraints || '—'}</p>
                <p><span className="kicker">Assumptions</span> {project.assumptions || '—'}</p>
                <p><span className="kicker">Kill / pivot</span> {project.killPivot || '—'}</p>
              </div>
            ) : null}
          </section>

          <section className="hud-frame" style={{ padding: 16 }}>
            <p className="board-label">History</p>
            {activity.map((a) => (
              <p key={a.id} className="muted">
                {a.createdAt.slice(0, 16).replace('T', ' ')} · {a.description}
              </p>
            ))}
          </section>
        </div>

        <aside className="stack">
          <section className="hud-frame" style={{ padding: 16 }}>
            <p className="board-label">Project velocity</p>
            <p className="proj-bar">{bar(vel.actual)} {vel.actual}%</p>
            <p className="muted">Planned {vel.planned}% · Actual {vel.actual}%</p>
            <p className="muted">Critical path {variance ? `-${variance}d` : '0'} · Latency {vel.latency}d</p>
            <p className="muted">Oldest blocker {vel.oldestBlocker}d · Milestones {ms.filter((m) => m.status === 'complete').length} / {ms.length}</p>
            <p>{labelVelocity(vel.mark)}</p>
          </section>

          <section className="hud-frame" style={{ padding: 16 }}>
            <p className="board-label">Decisions</p>
            {pendingDecisions(ds).length === 0 ? <p className="today-empty">No executive decisions waiting.</p> : null}
            {pendingDecisions(ds).map((d) => (
              <div key={d.id} className="stack" style={{ marginBottom: 10 }}>
                <strong>⚠ {d.title}</strong>
                <span className="muted">{d.deadline ? `Due ${d.deadline}` : ''} {d.impactIfDelayed ? `· ${d.impactIfDelayed}` : ''}</span>
                <div className="row">
                  <button className="btn" onClick={() => store.resolveDecision(d.id, 'approved', 'Approved')}>Approve</button>
                  <button className="btn-ghost" onClick={() => store.resolveDecision(d.id, 'rejected', 'Rejected')}>Reject</button>
                  <button className="btn-ghost" onClick={() => store.resolveDecision(d.id, 'more_info')}>Request data</button>
                  <button className="btn-ghost" onClick={() => store.resolveDecision(d.id, 'delegated', 'Delegated')}>Delegate</button>
                </div>
              </div>
            ))}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!decTitle.trim()) return
                store.addDecision({ projectId: project.id, title: decTitle.trim(), owner: project.owner, deadline: todayISO() })
                setDecTitle('')
              }}
            >
              <input className="input" value={decTitle} onChange={(e) => setDecTitle(e.target.value)} placeholder="New decision" />
            </form>
          </section>

          <section className="hud-frame" style={{ padding: 16 }}>
            <p className="board-label">Waiting on</p>
            {waiting.length === 0 ? <p className="today-empty">No active bottlenecks from others.</p> : null}
            {waiting.map((w) => (
              <p key={w.id} className="board-wait">
                <span>{w.person} — {w.deliverable}</span>
                <span className="muted">{w.dueAt ?? ''} {w.dueAt && w.dueAt < todayISO() ? 'OVERDUE' : ''}</span>
                <button className="chip" onClick={() => store.resolveWaiting(w.id)}>Received</button>
              </p>
            ))}
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault()
                if (!waitPerson.trim() || !waitWhat.trim()) return
                store.addWaitingOn({ projectId: project.id, person: waitPerson, deliverable: waitWhat, dueAt: todayISO() })
                setWaitPerson('')
                setWaitWhat('')
              }}
            >
              <input className="input" value={waitPerson} onChange={(e) => setWaitPerson(e.target.value)} placeholder="Person" />
              <input className="input" value={waitWhat} onChange={(e) => setWaitWhat(e.target.value)} placeholder="Deliverable" />
              <button className="btn-ghost" type="submit">Add</button>
            </form>
          </section>

          <section className="hud-frame" style={{ padding: 16 }}>
            <p className="board-label">Sepho // Project commander</p>
            <p className="board-brief" style={{ whiteSpace: 'pre-wrap' }}>{brief.text}</p>
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => setPlan(true)}>Execute plan</button>
              <button className="btn-ghost" onClick={() => setPlan(true)}>Modify</button>
              <button className="btn-ghost" onClick={() => store.logProject(project.id, 'commander', 'Plan ignored.')}>Ignore</button>
            </div>
            <form
              style={{ marginTop: 8 }}
              onSubmit={(e) => {
                e.preventDefault()
                if (!ask.trim()) return
                store.logProject(project.id, 'commander', `Asked Sepho: ${ask.trim()}`)
                setAsk('')
              }}
            >
              <input className="input" value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Ask Sepho…" />
            </form>
            <form
              style={{ marginTop: 8 }}
              onSubmit={(e) => {
                e.preventDefault()
                if (!blockTitle.trim()) return
                store.addBlocker({ projectId: project.id, title: blockTitle.trim(), owner: project.owner, milestoneId: cur?.id, isPrimary: true })
                setBlockTitle('')
              }}
            >
              <input className="input" value={blockTitle} onChange={(e) => setBlockTitle(e.target.value)} placeholder="Add blocker" />
            </form>
          </section>
        </aside>
      </div>

      {plan ? (
        <Modal title="Execute plan" onClose={() => setPlan(false)}>
          <p className="muted">Sepho will:</p>
          <ul>
            {brief.plan.map((a) => (
              <li key={a.title}>+ {a.title}</li>
            ))}
            {!brief.plan.length ? <li>+ Log commander recommendation</li> : null}
          </ul>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn-ghost" onClick={() => setPlan(false)}>Cancel</button>
            <button
              className="btn"
              onClick={() => {
                brief.plan.forEach((a) => store.addTask({ title: a.title, notes: a.notes ?? '', projectId: project.id, due: todayISO() }))
                store.logProject(project.id, 'commander', 'Plan executed.')
                setPlan(false)
              }}
            >
              Confirm
            </button>
          </div>
        </Modal>
      ) : null}

      {complete ? (
        <Modal title="Close project" onClose={() => setComplete(false)}>
          <p className="muted">Was definition of done achieved?</p>
          <p><span className="kicker">Objective</span> {project.objective}</p>
          <p>{project.definitionOfDone}</p>
          <p className="muted">Metric: {project.successMetric}</p>
          <Field label="Outcome">
            <textarea className="textarea" value={outcome} onChange={(e) => setOutcome(e.target.value)} />
          </Field>
          <Field label="Lessons">
            <textarea className="textarea" value={lessons} onChange={(e) => setLessons(e.target.value)} />
          </Field>
          <div className="row">
            <button className="btn" onClick={() => { store.completeProject(project.id, outcome, 'success', lessons); setComplete(false); onBack() }}>Success</button>
            <button className="btn-ghost" onClick={() => { store.completeProject(project.id, outcome, 'partial', lessons); setComplete(false); onBack() }}>Partial</button>
            <button className="btn-ghost" onClick={() => { store.completeProject(project.id, outcome, 'failed', lessons); setComplete(false); onBack() }}>Failed</button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}

