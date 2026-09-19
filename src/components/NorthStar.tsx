import { useState } from 'react'
import { Field } from './ui'
import type { GoalCycle } from '../lib/types'
import { useStore } from '../store'

export function NorthStar({ cycle }: { cycle?: GoalCycle }) {
  const { state, updateSettings } = useStore()
  const s = state.settings
  const [edit, setEdit] = useState(false)
  const [draft, setDraft] = useState({
    northStar: s.northStar ?? '',
    northStarHorizon: s.northStarHorizon ?? '',
    northStarMetric: s.northStarMetric ?? '',
  })

  return (
    <section className="hud-frame north-star">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <p className="board-label">North star // Long-term goal</p>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            if (edit) updateSettings(draft)
            else setDraft({ northStar: s.northStar ?? '', northStarHorizon: s.northStarHorizon ?? '', northStarMetric: s.northStarMetric ?? '' })
            setEdit((v) => !v)
          }}
        >
          {edit ? 'Save' : s.northStar ? 'Edit' : 'Set'}
        </button>
      </div>
      {edit ? (
        <div className="stack" style={{ marginTop: 8 }}>
          <Field label="Long-term goal">
            <textarea className="textarea" rows={2} value={draft.northStar} onChange={(e) => setDraft({ ...draft, northStar: e.target.value })} placeholder="Build the Brivaus Group into a multi-billion-dollar holding company" />
          </Field>
          <div className="grid-2">
            <Field label="Time horizon">
              <input className="input" value={draft.northStarHorizon} onChange={(e) => setDraft({ ...draft, northStarHorizon: e.target.value })} placeholder="10 years" />
            </Field>
            <Field label="Metric (optional)">
              <input className="input" value={draft.northStarMetric} onChange={(e) => setDraft({ ...draft, northStarMetric: e.target.value })} placeholder="Holding company enterprise value" />
            </Field>
          </div>
        </div>
      ) : (
        <>
          <p className="north-star-line">{s.northStar?.trim() || 'Set the long-term mission so 90-day work cannot drift.'}</p>
          {s.northStarHorizon?.trim() ? (
            <p className="muted">
              <span className="kicker">Time horizon</span> {s.northStarHorizon}
              {s.northStarMetric?.trim() ? ` · ${s.northStarMetric}` : ''}
            </p>
          ) : s.northStarMetric?.trim() ? (
            <p className="muted">
              <span className="kicker">Metric</span> {s.northStarMetric}
            </p>
          ) : null}
        </>
      )}
      {cycle ? (
        <p className="north-star-cycle">
          <span className="kicker">Current 90-day cycle</span> {cycle.name}
          <span className="muted"> — this cycle should move the north star.</span>
        </p>
      ) : null}
    </section>
  )
}
