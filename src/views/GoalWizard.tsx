import { useEffect, useState } from 'react'
import { Field, Modal } from '../components/ui'
import { clearDraft, loadDraft, saveDraft } from '../lib/drafts'
import { GOAL_CATEGORIES, qualityCheck } from '../lib/goal-engine'
import type { GoalCategory, MoverEntity } from '../lib/types'
import { useStore } from '../store'

type Draft = {
  title: string
  category: GoalCategory
  categoryCustom: string
  startDate: string
  targetDate: string
  owner: string
  whyItMatters: string
  whyNow: string
  consequence: string
  metricName: string
  baseline: string
  currentValue: string
  targetValue: string
  unit: string
  definitionOfDone: string
  day30: string
  day30v: string
  day60: string
  day60v: string
  day90: string
  day90v: string
  reward: string
  northStarLink: string
  movers: { label: string; type: MoverEntity; entityId: string }[]
  projectIds: string[]
}

const empty = (owner: string, start: string, end: string): Draft => ({
  title: '',
  category: 'business',
  categoryCustom: '',
  startDate: start,
  targetDate: end,
  owner,
  whyItMatters: '',
  whyNow: '',
  consequence: '',
  metricName: '',
  baseline: '',
  currentValue: '',
  targetValue: '',
  unit: '',
  definitionOfDone: '',
  day30: '',
  day30v: '',
  day60: '',
  day60v: '',
  day90: '',
  day90v: '',
  reward: '',
  northStarLink: '',
  movers: [{ label: '', type: 'project', entityId: '' }],
  projectIds: [],
})

export function GoalWizard({
  cycleId,
  startDate,
  endDate,
  override,
  onClose,
  onCreated,
}: {
  cycleId: string
  startDate: string
  endDate: string
  override?: boolean
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const { state, addGoal, addCheckpoint, addMover, updateProject, addTask, addHabit } = useStore()
  const [step, setStep] = useState(() => loadDraft<{ step: number }>('goal')?.step ?? 1)
  const [draft, setDraft] = useState(() => {
    const blank = empty(state.settings.name || 'Kens', startDate, endDate)
    const saved = loadDraft<{ draft: Draft }>('goal')?.draft
    return saved ? { ...blank, ...saved } : blank
  })
  const [help, setHelp] = useState('')
  const set = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }))

  useEffect(() => {
    const t = window.setTimeout(() => saveDraft('goal', { step, draft }), 200)
    return () => window.clearTimeout(t)
  }, [draft, step])
  useEffect(() => () => saveDraft('goal', { step, draft }), [draft, step])

  const qc = qualityCheck({
    title: draft.title,
    targetDate: draft.targetDate,
    metricName: draft.metricName,
    baseline: draft.baseline,
    targetValue: draft.targetValue,
    day30: draft.day30,
    day60: draft.day60,
    day90: draft.day90,
    movers: draft.movers.filter((m) => m.label.trim() || m.entityId).length,
  })

  const commit = (status: 'active' | 'backlog') => {
    if (!draft.title.trim()) return
    const result = addGoal(
      {
        title: draft.title,
        cycleId,
        owner: draft.owner,
        category: draft.category,
        categoryCustom: draft.categoryCustom,
        startDate: draft.startDate,
        targetDate: draft.targetDate,
        whyItMatters: draft.whyItMatters,
        whyNow: draft.whyNow,
        consequence: draft.consequence,
        metricName: draft.metricName,
        baseline: draft.baseline,
        currentValue: draft.currentValue || draft.baseline,
        targetValue: draft.targetValue,
        unit: draft.unit,
        definitionOfDone: draft.definitionOfDone,
        reward: draft.reward,
        northStarLink: draft.northStarLink,
        notes: draft.whyItMatters,
        status,
      },
      { overrideCapacity: override || status === 'backlog' },
    )
    if (typeof result !== 'string') {
      alert('Focus capacity reached. Pause, complete, or override.')
      return
    }
    addCheckpoint({ goalId: result, day: 30, targetDescription: draft.day30, targetValue: draft.day30v })
    addCheckpoint({ goalId: result, day: 60, targetDescription: draft.day60, targetValue: draft.day60v })
    addCheckpoint({ goalId: result, day: 90, targetDescription: draft.day90, targetValue: draft.day90v || draft.targetValue })
    clearDraft('goal')
    draft.projectIds.forEach((pid) => updateProject(pid, { goalId: result }))
    draft.movers
      .filter((m) => m.label.trim() || m.entityId)
      .slice(0, 5)
      .forEach((m, i) => {
        let entityId = m.entityId
        let entityType = m.type
        if (!entityId && m.label.trim()) {
          if (m.type === 'task') entityId = addTask({ title: m.label.trim(), listId: 'work', goalId: result })
          else if (m.type === 'habit') entityId = addHabit({ name: m.label.trim() })
          else {
            entityType = 'task'
            entityId = addTask({ title: m.label.trim(), listId: 'work', goalId: result })
          }
        }
        if (entityId) addMover({ goalId: result, rank: i + 1, entityType, entityId })
        if (entityType === 'project' && entityId) updateProject(entityId, { goalId: result })
      })
    onCreated(result)
  }

  return (
    <Modal title={`New goal // Step ${step} of 8`} onClose={onClose} wide persist>
      <div className="stack">
        <p className="muted">Draft autosaves as you type. Leaving this page will not wipe it.</p>
        {step === 1 ? (
          <>
            <p className="kicker">Define the goal</p>
            <p className="muted">
              What do you want to achieve in the next 90 days?
              {state.northStars.find((n) => n.id === state.goalCycles.find((c) => c.id === cycleId)?.northStarId)
                ? ` This command reports to: ${state.northStars.find((n) => n.id === state.goalCycles.find((c) => c.id === cycleId)?.northStarId)?.title}`
                : ''}
            </p>
            <Field label="Goal title *">
              <input className="input" value={draft.title} onChange={(e) => set({ title: e.target.value })} autoFocus />
            </Field>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                if (!draft.title.trim()) return
                const sharpened = draft.title.toLowerCase().startsWith('increase') || draft.title.includes('from')
                  ? draft.title
                  : `Increase ${draft.title.trim()} from [baseline] to [target] by ${draft.targetDate}.`
                setHelp(sharpened)
              }}
            >
              Help me define this goal
            </button>
            {help ? (
              <p className="muted">
                Suggested: {help}{' '}
                <button className="chip" onClick={() => { set({ title: help }); setHelp('') }}>
                  Use
                </button>
              </p>
            ) : null}
            <div className="grid-2">
              <Field label="Category">
                <select className="select" value={draft.category} onChange={(e) => set({ category: e.target.value as GoalCategory })}>
                  {GOAL_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Owner">
                <input className="input" value={draft.owner} onChange={(e) => set({ owner: e.target.value })} />
              </Field>
            </div>
            {draft.category === 'custom' ? (
              <Field label="Custom category">
                <input className="input" value={draft.categoryCustom} onChange={(e) => set({ categoryCustom: e.target.value })} />
              </Field>
            ) : null}
            <div className="grid-2">
              <Field label="Start">
                <input className="input" type="date" value={draft.startDate} onChange={(e) => set({ startDate: e.target.value })} />
              </Field>
              <Field label="Target date *">
                <input className="input" type="date" value={draft.targetDate} onChange={(e) => set({ targetDate: e.target.value })} />
              </Field>
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <p className="kicker">Why this matters</p>
            <Field label="What difference will achieving this make?">
              <textarea className="textarea" value={draft.whyItMatters} onChange={(e) => set({ whyItMatters: e.target.value })} />
            </Field>
            <Field label="Why now?">
              <textarea className="textarea" value={draft.whyNow} onChange={(e) => set({ whyNow: e.target.value })} />
            </Field>
            <Field label="What happens if this is not achieved?">
              <textarea className="textarea" value={draft.consequence} onChange={(e) => set({ consequence: e.target.value })} />
            </Field>
            <Field label="How does this move the north star? (optional)">
              <textarea className="textarea" value={draft.northStarLink} onChange={(e) => set({ northStarLink: e.target.value })} placeholder="Build transportation infrastructure for Brivaus Group." />
            </Field>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <p className="kicker">Define success</p>
            <p className="muted">How will Sepho know this goal is complete?</p>
            <Field label="Success metric">
              <input className="input" value={draft.metricName} onChange={(e) => set({ metricName: e.target.value })} placeholder="Monthly revenue" />
            </Field>
            <div className="grid-2">
              <Field label="Baseline">
                <input className="input" value={draft.baseline} onChange={(e) => set({ baseline: e.target.value })} placeholder="75000" />
              </Field>
              <Field label="90-day target">
                <input className="input" value={draft.targetValue} onChange={(e) => set({ targetValue: e.target.value })} placeholder="100000" />
              </Field>
            </div>
            <div className="grid-2">
              <Field label="Current">
                <input className="input" value={draft.currentValue} onChange={(e) => set({ currentValue: e.target.value })} />
              </Field>
              <Field label="Unit">
                <input className="input" value={draft.unit} onChange={(e) => set({ unit: e.target.value })} placeholder="$ / month" />
              </Field>
            </div>
            <Field label="Definition of done">
              <textarea className="textarea" value={draft.definitionOfDone} onChange={(e) => set({ definitionOfDone: e.target.value })} />
            </Field>
          </>
        ) : null}

        {step === 4 ? (
          <>
            <p className="kicker">30 / 60 / 90 roadmap</p>
            <Field label="30 days // Foundation">
              <input className="input" value={draft.day30} onChange={(e) => set({ day30: e.target.value })} placeholder="First route operational" />
              <input className="input" style={{ marginTop: 6 }} value={draft.day30v} onChange={(e) => set({ day30v: e.target.value })} placeholder="Target value" />
            </Field>
            <Field label="60 days // Momentum">
              <input className="input" value={draft.day60} onChange={(e) => set({ day60: e.target.value })} placeholder="Three routes operational" />
              <input className="input" style={{ marginTop: 6 }} value={draft.day60v} onChange={(e) => set({ day60v: e.target.value })} placeholder="Target value" />
            </Field>
            <Field label="90 days // Target">
              <input className="input" value={draft.day90} onChange={(e) => set({ day90: e.target.value })} placeholder="Four profitable routes" />
              <input className="input" style={{ marginTop: 6 }} value={draft.day90v} onChange={(e) => set({ day90v: e.target.value })} placeholder="Target value" />
            </Field>
          </>
        ) : null}

        {step === 5 ? (
          <>
            <p className="kicker">Significant movers</p>
            <p className="muted">The few things most likely to move this goal. Max 5. Link a project, task, or habit — do not invent a second list.</p>
            {draft.movers.map((m, i) => (
              <div key={i} className="cpath-edit-row is-add">
                <input
                  className="input"
                  placeholder={`Mover ${i + 1}`}
                  value={m.label}
                  onChange={(e) =>
                    set({
                      movers: draft.movers.map((x, n) => (n === i ? { ...x, label: e.target.value } : x)),
                    })
                  }
                />
                <select
                  className="select"
                  value={m.entityId ? `${m.type}:${m.entityId}` : m.type}
                  onChange={(e) => {
                    const v = e.target.value
                    const [type, ...rest] = v.split(':')
                    const entityId = rest.join(':')
                    set({
                      movers: draft.movers.map((x, n) =>
                        n === i ? { ...x, type: (type as MoverEntity) || 'project', entityId, label: x.label } : x,
                      ),
                    })
                  }}
                >
                  <option value="project">New / label as project work</option>
                  <option value="task">Create task from label</option>
                  <option value="habit">Create habit from label</option>
                  {state.projects.filter((p) => p.state !== 'archived').map((p) => (
                    <option key={p.id} value={`project:${p.id}`}>
                      Project: {p.name}
                    </option>
                  ))}
                  {state.tasks.filter((t) => !t.completed).slice(0, 40).map((t) => (
                    <option key={t.id} value={`task:${t.id}`}>
                      Task: {t.title}
                    </option>
                  ))}
                  {state.habits.filter((h) => !h.archived).map((h) => (
                    <option key={h.id} value={`habit:${h.id}`}>
                      Habit: {h.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            {draft.movers.length < 5 ? (
              <button type="button" className="btn-ghost" onClick={() => set({ movers: [...draft.movers, { label: '', type: 'project', entityId: '' }] })}>
                + Mover
              </button>
            ) : null}
          </>
        ) : null}

        {step === 6 ? (
          <>
            <p className="kicker">Projects driving this goal</p>
            {state.projects
              .filter((p) => p.state !== 'archived')
              .map((p) => (
                <label key={p.id} className="row">
                  <input
                    type="checkbox"
                    checked={draft.projectIds.includes(p.id)}
                    onChange={(e) =>
                      set({
                        projectIds: e.target.checked ? [...draft.projectIds, p.id] : draft.projectIds.filter((id) => id !== p.id),
                      })
                    }
                  />
                  {p.name}
                </label>
              ))}
            {!state.projects.length ? <p className="muted">No projects yet. Create one from Projects, then link it here.</p> : null}
          </>
        ) : null}

        {step === 7 ? (
          <>
            <p className="kicker">Reward</p>
            <Field label="How will you reward yourself when this is achieved? (optional)">
              <input className="input" value={draft.reward} onChange={(e) => set({ reward: e.target.value })} />
            </Field>
          </>
        ) : null}

        {step === 8 ? (
          <>
            <p className="kicker">Commit</p>
            <p>
              <strong>{draft.title || 'Untitled'}</strong>
            </p>
            <p className="muted">{draft.whyItMatters || '—'}</p>
            <p className="muted">
              Metric {draft.metricName || '—'} · {draft.baseline || '?'} → {draft.targetValue || '?'} {draft.unit}
            </p>
            <p className="muted">30 {draft.day30 || '—'} · 60 {draft.day60 || '—'} · 90 {draft.day90 || draft.targetValue || '—'}</p>
            <p className="kicker">{qc.ready ? 'Ready' : 'Needs clarification'}</p>
            {!qc.ready ? <p className="gate-error">Missing: {qc.missing.join(', ')}</p> : null}
          </>
        ) : null}

        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="btn-ghost" onClick={() => (step === 1 ? onClose() : setStep((n) => n - 1))}>
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          {step < 8 ? (
            <button type="button" className="btn" onClick={() => setStep((n) => n + 1)} disabled={step === 1 && !draft.title.trim()}>
              Next
            </button>
          ) : (
            <div className="row">
              <button type="button" className="btn-ghost" onClick={() => commit('backlog')}>
                Save to backlog
              </button>
              <button type="button" className="btn" onClick={() => commit('active')}>
                Activate goal
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
