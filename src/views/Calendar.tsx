import { useMemo, useState } from 'react'
import { ColorDots, Field, Modal } from '../components/ui'
import { Icon } from '../icons'
import {
  addDays,
  formatTime,
  minutesOf,
  monthCells,
  monthName,
  startOfWeek,
  toISO,
  todayISO,
  weekdayNames,
} from '../lib/dates'
import { PALETTE, type CalEvent } from '../lib/types'
import { useStore } from '../store'

type View = 'month' | 'week' | 'day'

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6)

export function Calendar() {
  const { state, addEvent, updateEvent, deleteEvent } = useStore()
  const weekStartsOn = state.settings.weekStartsOn
  const [cursor, setCursor] = useState(() => new Date())
  const [view, setView] = useState<View>('month')
  const [draft, setDraft] = useState<Partial<CalEvent> | null>(null)
  const today = todayISO()
  const names = weekdayNames(weekStartsOn)

  const cells = useMemo(
    () => monthCells(cursor.getFullYear(), cursor.getMonth(), weekStartsOn),
    [cursor, weekStartsOn],
  )
  const weekStart = startOfWeek(cursor, weekStartsOn)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const dayIso = toISO(cursor)

  const eventsOn = (iso: string) => state.events.filter((e) => e.date === iso)
  const tasksOn = (iso: string) => state.tasks.filter((t) => t.due === iso && !t.completed)

  const save = () => {
    if (!draft?.title?.trim() || !draft.date) return
    if (draft.id) {
      updateEvent(draft.id, draft)
    } else {
      addEvent({
        title: draft.title,
        date: draft.date,
        start: draft.start,
        end: draft.end,
        allDay: Boolean(draft.allDay || !draft.start),
        color: draft.color ?? PALETTE[2],
        notes: draft.notes ?? '',
        location: draft.location ?? '',
      })
    }
    setDraft(null)
  }

  const openNew = (date: string, start?: string) => {
    setDraft({
      title: '',
      date,
      start,
      allDay: !start,
      color: PALETTE[2],
      notes: '',
      location: '',
    })
  }

  const form = draft ? (
    <Modal title={draft.id ? 'Edit event' : 'New event'} onClose={() => setDraft(null)}>
      <div className="stack">
        <Field label="Title">
          <input className="input" value={draft.title ?? ''} onChange={(e) => setDraft({ ...draft, title: e.target.value })} autoFocus />
        </Field>
        <Field label="Date">
          <input className="input" type="date" value={draft.date ?? ''} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
        </Field>
        <label className="row">
          <input
            type="checkbox"
            checked={Boolean(draft.allDay)}
            onChange={(e) => setDraft({ ...draft, allDay: e.target.checked, start: e.target.checked ? undefined : draft.start ?? '09:00' })}
          />
          All day
        </label>
        {!draft.allDay ? (
          <div className="grid-2">
            <Field label="Start">
              <input className="input" type="time" value={draft.start ?? ''} onChange={(e) => setDraft({ ...draft, start: e.target.value })} />
            </Field>
            <Field label="End">
              <input className="input" type="time" value={draft.end ?? ''} onChange={(e) => setDraft({ ...draft, end: e.target.value })} />
            </Field>
          </div>
        ) : null}
        <Field label="Location">
          <input className="input" value={draft.location ?? ''} onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
        </Field>
        <Field label="Notes">
          <textarea className="textarea" value={draft.notes ?? ''} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
        </Field>
        <ColorDots colors={PALETTE} value={draft.color ?? PALETTE[2]} onChange={(color) => setDraft({ ...draft, color })} />
        <div className="row" style={{ justifyContent: 'space-between' }}>
          {draft.id ? (
            <button className="btn-danger" onClick={() => { deleteEvent(draft.id!); setDraft(null) }}>
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
  ) : null

  const shift = (n: number) => {
    const d = new Date(cursor)
    if (view === 'month') d.setMonth(d.getMonth() + n)
    else d.setDate(d.getDate() + n * (view === 'week' ? 7 : 1))
    setCursor(d)
  }

  return (
    <div>
      <header className="page-head">
        <div>
          <p className="kicker">Time on a page</p>
          <h1>{view === 'day' ? cursor.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : monthName(cursor)}</h1>
        </div>
        <button className="btn" onClick={() => openNew(dayIso)}>
          <Icon name="plus" size={16} /> Event
        </button>
      </header>

      <div className="cal-toolbar">
        <div className="row">
          <button className="btn-icon" onClick={() => shift(-1)} aria-label="Previous">
            <Icon name="chevronL" />
          </button>
          <button className="btn-ghost" onClick={() => setCursor(new Date())}>
            Today
          </button>
          <button className="btn-icon" onClick={() => shift(1)} aria-label="Next">
            <Icon name="chevron" />
          </button>
        </div>
        <div className="row">
          {(['month', 'week', 'day'] as View[]).map((v) => (
            <button key={v} className="chip" data-on={view === v} onClick={() => setView(v)}>
              {v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {view === 'month' ? (
        <div className="cal-month">
          {names.map((n) => (
            <div key={n} className="cal-hd">
              {n}
            </div>
          ))}
          {cells.map((c) => {
            const evs = eventsOn(c.iso)
            const tks = tasksOn(c.iso)
            return (
              <button
                key={c.iso}
                className={`cal-cell${c.inMonth ? '' : ' out'}${c.iso === today ? ' today' : ''}`}
                onClick={() => openNew(c.iso)}
              >
                <span className="day-num">{c.date.getDate()}</span>
                {evs.slice(0, 3).map((e) => (
                  <span
                    key={e.id}
                    className="pill"
                    style={{ ['--c' as string]: e.color }}
                    onClick={(ev) => {
                      ev.stopPropagation()
                      setDraft({ ...e })
                    }}
                  >
                    {e.title}
                  </span>
                ))}
                {tks.length ? <span className="muted" style={{ fontSize: 11 }}>{tks.length} task{tks.length > 1 ? 's' : ''}</span> : null}
                {evs.length > 3 ? <span className="muted" style={{ fontSize: 11 }}>+{evs.length - 3}</span> : null}
              </button>
            )
          })}
        </div>
      ) : null}

      {view === 'week' || view === 'day' ? (
        <WeekGrid
          days={view === 'day' ? [cursor] : weekDays}
          events={state.events}
          onSlot={openNew}
          onEvent={(e) => setDraft({ ...e })}
        />
      ) : null}

      {form}
    </div>
  )
}

function WeekGrid({
  days,
  events,
  onSlot,
  onEvent,
}: {
  days: Date[]
  events: CalEvent[]
  onSlot: (iso: string, start?: string) => void
  onEvent: (e: CalEvent) => void
}) {
  const isos = days.map(toISO)
  return (
    <div className="week-grid" style={{ gridTemplateColumns: `64px repeat(${days.length}, 1fr)` }}>
      <div className="gutter">All day</div>
      {days.map((d) => {
        const iso = toISO(d)
        const all = events.filter((e) => e.date === iso && (e.allDay || !e.start))
        return (
          <div key={iso} className="gutter" style={{ minHeight: 44 }} onClick={() => onSlot(iso)}>
            <div className="kicker">{d.toLocaleDateString(undefined, { weekday: 'short' })} {d.getDate()}</div>
            {all.map((e) => (
              <button key={e.id} className="pill" style={{ ['--c' as string]: e.color, display: 'block', marginTop: 4 }} onClick={(ev) => { ev.stopPropagation(); onEvent(e) }}>
                {e.title}
              </button>
            ))}
          </div>
        )
      })}
      {HOURS.map((h) => (
        <HourRow key={h} hour={h} isos={isos} events={events} onSlot={onSlot} onEvent={onEvent} />
      ))}
    </div>
  )
}

function HourRow({
  hour,
  isos,
  events,
  onSlot,
  onEvent,
}: {
  hour: number
  isos: string[]
  events: CalEvent[]
  onSlot: (iso: string, start?: string) => void
  onEvent: (e: CalEvent) => void
}) {
  const label = `${hour % 12 || 12} ${hour < 12 ? 'AM' : 'PM'}`
  const stamp = `${String(hour).padStart(2, '0')}:00`
  return (
    <>
      <div className="gutter">{label}</div>
      {isos.map((iso) => {
        const timed = events.filter((e) => e.date === iso && e.start && Math.floor(minutesOf(e.start) / 60) === hour)
        return (
          <button key={iso + hour} className="hour-cell" onClick={() => onSlot(iso, stamp)}>
            {timed.map((e) => {
              const start = minutesOf(e.start!) - hour * 60
              const end = e.end ? minutesOf(e.end) : minutesOf(e.start!) + 60
              const height = Math.max(18, ((end - hour * 60 - start) / 60) * 48)
              return (
                <span
                  key={e.id}
                  className="event-block"
                  style={{
                    top: (start / 60) * 48,
                    height,
                    background: `color-mix(in srgb, ${e.color} 28%, white)`,
                    borderLeft: `3px solid ${e.color}`,
                  }}
                  onClick={(ev) => {
                    ev.stopPropagation()
                    onEvent(e)
                  }}
                >
                  {e.title}
                  <div className="muted">{formatTime(e.start!)}</div>
                </span>
              )
            })}
          </button>
        )
      })}
    </>
  )
}
