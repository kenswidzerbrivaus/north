import { useState } from 'react'
import { Empty, Field, Modal } from '../components/ui'
import { Icon } from '../icons'
import { formatShort } from '../lib/dates'
import type { Goal } from '../lib/types'
import { useStore } from '../store'

export function Goals() {
  const { state, addGoal, updateGoal, deleteGoal } = useStore()
  const [edit, setEdit] = useState<Partial<Goal> | null>(null)

  const save = () => {
    if (!edit?.title?.trim()) return
    if (edit.id) updateGoal(edit.id, edit)
    else addGoal({ title: edit.title, notes: edit.notes ?? '', targetDate: edit.targetDate, progress: edit.progress ?? 0, status: 'active' })
    setEdit(null)
  }

  return (
    <div>
      <header className="page-head">
        <div>
          <p className="kicker">Farther than today</p>
          <h1>Goals</h1>
        </div>
        <button className="btn" onClick={() => setEdit({ title: '', notes: '', progress: 0, status: 'active' })}>
          <Icon name="plus" size={16} /> Goal
        </button>
      </header>

      {state.goals.length === 0 ? (
        <Empty title="No goals yet" body="Name a destination. Progress can be messy and still count." />
      ) : (
        <div className="grid-2">
          {state.goals.map((g) => (
            <article key={g.id} className="card" onClick={() => setEdit({ ...g })} style={{ cursor: 'pointer' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <h3>{g.title}</h3>
                <span className="chip" data-on={g.status === 'done'}>
                  {g.status}
                </span>
              </div>
              {g.notes ? <p className="muted">{g.notes}</p> : null}
              <div className="progress" style={{ margin: '12px 0 8px' }}>
                <span style={{ width: `${g.progress}%` }} />
              </div>
              <p className="meta">
                {g.progress}%
                {g.targetDate ? ` · by ${formatShort(g.targetDate)}` : ''}
                {state.projects.filter((p) => p.goalId === g.id).length
                  ? ` · ${state.projects.filter((p) => p.goalId === g.id).map((p) => p.name).join(', ')}`
                  : ''}
              </p>
            </article>
          ))}
        </div>
      )}

      {edit ? (
        <Modal title={edit.id ? 'Edit goal' : 'New goal'} onClose={() => setEdit(null)}>
          <div className="stack">
            <Field label="Title">
              <input className="input" value={edit.title ?? ''} onChange={(e) => setEdit({ ...edit, title: e.target.value })} autoFocus />
            </Field>
            <Field label="Notes">
              <textarea className="textarea" value={edit.notes ?? ''} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
            </Field>
            <Field label="Target date">
              <input className="input" type="date" value={edit.targetDate ?? ''} onChange={(e) => setEdit({ ...edit, targetDate: e.target.value || undefined })} />
            </Field>
            <Field label={`Progress ${edit.progress ?? 0}%`}>
              <input
                type="range"
                min={0}
                max={100}
                value={edit.progress ?? 0}
                onChange={(e) => setEdit({ ...edit, progress: Number(e.target.value) })}
              />
            </Field>
            <Field label="Status">
              <select
                className="select"
                value={edit.status ?? 'active'}
                onChange={(e) => setEdit({ ...edit, status: e.target.value as Goal['status'] })}
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="done">Done</option>
              </select>
            </Field>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              {edit.id ? (
                <button className="btn-danger" onClick={() => { deleteGoal(edit.id!); setEdit(null) }}>
                  Delete
                </button>
              ) : (
                <span />
              )}
              <button className="btn" onClick={save}>
                Save
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
