import { useState } from 'react'
import { Field } from './ui'
import { STAR_PALETTE } from '../lib/types'
import type { GoalCycle, NorthStar as Star } from '../lib/types'
import { useStore } from '../store'

export function NorthStar({
  star,
  cycle,
  onSelect,
  variant = 'command',
  onOpen,
  forceCreate = false,
}: {
  star?: Star
  cycle?: GoalCycle
  onSelect?: (id: string) => void
  variant?: 'card' | 'command'
  onOpen?: () => void
  forceCreate?: boolean
}) {
  const { state, addNorthStar, updateNorthStar } = useStore()
  const stars = state.northStars
  const [edit, setEdit] = useState(forceCreate || !stars.length)
  const [creating, setCreating] = useState(forceCreate || !stars.length)
  const [draft, setDraft] = useState({
    title: star?.title ?? '',
    horizon: star?.horizon ?? '',
    metric: star?.metric ?? '',
  })

  if (variant === 'card' && star) {
    return (
      <div
        className="hud-frame north-star north-star-card"
        data-star-id={star.id}
        style={{ ['--ns' as string]: star.color || '#6ee7ff' }}
      >
        <button type="button" className="north-star-handle" aria-label="Drag to reorder">
          ⋮⋮
        </button>
        <button type="button" className="north-star-open" onClick={onOpen}>
          <p className="board-label">North star // Long-term goal</p>
          <p className="north-star-line">{star.title.trim() || 'Untitled'}</p>
          {star.horizon.trim() || star.metric.trim() ? (
            <p className="muted">
              {star.horizon.trim() ? (
                <>
                  <span className="kicker">Time horizon</span> {star.horizon}
                </>
              ) : null}
              {star.horizon.trim() && star.metric.trim() ? ' · ' : null}
              {star.metric.trim() || null}
            </p>
          ) : null}
          <p className="north-star-cycle">
            <span className="kicker">90-day command</span>{' '}
            {cycle ? cycle.name : 'None yet — open to start one'}
          </p>
        </button>
      </div>
    )
  }

  return (
    <section className="hud-frame north-star" style={{ ['--ns' as string]: star?.color || '#6ee7ff' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <p className="board-label">North star // Long-term goal</p>
        <div className="row">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setCreating(true)
              setEdit(true)
              setDraft({ title: '', horizon: '', metric: '' })
            }}
          >
            + Star
          </button>
          {star && !creating ? (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                if (edit) {
                  if (draft.title.trim()) updateNorthStar(star.id, { title: draft.title.trim(), horizon: draft.horizon, metric: draft.metric })
                  setEdit(false)
                } else {
                  setDraft({ title: star.title, horizon: star.horizon, metric: star.metric })
                  setEdit(true)
                }
              }}
            >
              {edit ? 'Save' : 'Edit'}
            </button>
          ) : null}
        </div>
      </div>
      {edit ? (
        <div className="stack" style={{ marginTop: 8 }}>
          <Field label="Long-term goal">
            <textarea className="textarea" rows={2} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Build the Brivaus Group into a multi-billion-dollar holding company" />
          </Field>
          <div className="grid-2">
            <Field label="Time horizon">
              <input className="input" value={draft.horizon} onChange={(e) => setDraft({ ...draft, horizon: e.target.value })} placeholder="10 years" />
            </Field>
            <Field label="Metric (optional)">
              <input className="input" value={draft.metric} onChange={(e) => setDraft({ ...draft, metric: e.target.value })} placeholder="Holding company enterprise value" />
            </Field>
          </div>
          {star && !creating ? (
            <div>
              <p className="kicker">Color — unique per north star</p>
              <div className="north-star-swatches">
                {STAR_PALETTE.map((c) => {
                  const taken = stars.some((n) => n.id !== star.id && n.color?.toLowerCase() === c.toLowerCase())
                  return (
                    <button
                      key={c}
                      type="button"
                      className="north-star-swatch"
                      data-on={star.color === c}
                      disabled={taken}
                      style={{ background: c, ['--ns' as string]: c }}
                      aria-label={c}
                      onClick={() => updateNorthStar(star.id, { color: c })}
                    />
                  )
                })}
              </div>
            </div>
          ) : null}
          {creating ? (
            <button
              type="button"
              className="btn"
              onClick={() => {
                if (!draft.title.trim()) return
                const id = addNorthStar({ title: draft.title, horizon: draft.horizon, metric: draft.metric })
                onSelect?.(id)
                setCreating(false)
                setEdit(false)
              }}
            >
              Save north star
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <p className="north-star-line">{star?.title.trim() || 'Create a north star. Every 90-day command must sit under one.'}</p>
          {star?.horizon.trim() ? (
            <p className="muted">
              <span className="kicker">Time horizon</span> {star.horizon}
              {star.metric.trim() ? ` · ${star.metric}` : ''}
            </p>
          ) : star?.metric.trim() ? (
            <p className="muted">
              <span className="kicker">Metric</span> {star.metric}
            </p>
          ) : null}
        </>
      )}
      {cycle ? (
        <p className="north-star-cycle">
          <span className="kicker">Current 90-day cycle</span> {cycle.name}
          <span className="muted"> — this command reports to this north star.</span>
        </p>
      ) : star ? (
        <p className="north-star-cycle muted">No 90-day command under this star yet. Start one and attach it here.</p>
      ) : null}
    </section>
  )
}
