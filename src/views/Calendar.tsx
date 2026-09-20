import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { mergeCalendars, useGoogleCalendar } from '../google'
import { ColorDots, Field, Modal } from '../components/ui'
import { Icon } from '../icons'
import {
  addDays,
  formatTime,
  minutesOf,
  monthCells,
  monthName,
  parseISO,
  startOfWeek,
  toISO,
  todayISO,
  weekdayNames,
} from '../lib/dates'
import { takeCalGap } from '../lib/cal-gap'
import { layoutTimedEvents, minutesToStamp, snapStart } from '../lib/cal-layout'
import { checkpointDate } from '../lib/goal-engine'
import { friendlyGoogleError } from '../lib/google-calendar'
import { hashParam } from '../lib/route'
import { nextEventColor, PALETTE, type CalEvent } from '../lib/types'
import { useStore } from '../store'

type View = 'month' | 'week' | 'day'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const HOUR_PX = 56

export function Calendar() {
  const { state, addEvent, updateEvent, updateTask, deleteEvent, syncFromCalendar, dropGoogleItems } = useStore()
  const gcal = useGoogleCalendar()
  const weekStartsOn = state.settings.weekStartsOn
  const [cursor, setCursor] = useState(() => new Date())
  const [view, setView] = useState<View>('month')
  const [draft, setDraft] = useState<Partial<CalEvent> | null>(null)
  const [toGoogle, setToGoogle] = useState(true)
  const [busy, setBusy] = useState(false)
  const [gap, setGap] = useState<{ date: string; startMin: number; endMin: number } | null>(null)
  const [moved, setMoved] = useState<Record<string, { date: string; start: string; end: string }>>({})
  const today = todayISO()
  const names = weekdayNames(weekStartsOn)
  const [projectId, setProjectId] = useState(() => hashParam('project'))
  useEffect(() => {
    const on = () => setProjectId(hashParam('project'))
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const merged = useMemo(() => mergeCalendars(state.events, gcal.events), [gcal.events, state.events])
  const allEvents = useMemo(() => {
    const patched = merged.map((e) => (moved[e.id] ? { ...e, ...moved[e.id], allDay: false } : e))
    if (!projectId) return patched
    const ids = new Set(
      state.tasks.filter((t) => t.projectId === projectId).flatMap((t) => [t.eventId, t.googleId].filter(Boolean) as string[]),
    )
    const proj = state.projects.find((p) => p.id === projectId)
    const needle = (proj?.name ?? '').toLowerCase()
    return patched.filter(
      (e) => ids.has(e.id) || (e.googleId && ids.has(e.googleId)) || (needle && e.title.toLowerCase().includes(needle.slice(0, 8))),
    )
  }, [merged, moved, projectId, state.projects, state.tasks])

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  useEffect(() => {
    if (gcal.connected) void gcal.refresh(new Date(year, month, 1))
  }, [year, month, gcal.connected, gcal.refresh])

  const cells = useMemo(
    () => monthCells(cursor.getFullYear(), cursor.getMonth(), weekStartsOn),
    [cursor, weekStartsOn],
  )
  const weekStart = startOfWeek(cursor, weekStartsOn)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const dayIso = toISO(cursor)

  const doneMarks = useMemo(() => {
    const ids = new Set<string>()
    const keys = new Set<string>()
    for (const t of state.tasks) {
      if (!t.completed) continue
      if (t.eventId) ids.add(t.eventId)
      if (t.googleId) {
        ids.add(t.googleId)
        ids.add(`gcal:${t.googleId}`)
      }
      if (t.due) keys.add(`${t.due}|${t.title.trim().toLowerCase()}`)
    }
    return { ids, keys }
  }, [state.tasks])
  const isDone = (e: CalEvent) =>
    doneMarks.ids.has(e.id) ||
    (e.googleId ? doneMarks.ids.has(e.googleId) : false) ||
    doneMarks.keys.has(`${e.date}|${e.title.trim().toLowerCase()}`)

  const eventsOn = (iso: string) => allEvents.filter((e) => e.date === iso)
  const tasksOn = (iso: string) =>
    state.tasks.filter((t) => t.due === iso && !t.completed && !t.eventId && !t.googleId)

  const save = async () => {
    if (!draft?.title?.trim() || !draft.date || busy) return
    const start = draft.start?.trim() || undefined
    const end = draft.end?.trim() || undefined
    const payload = {
      title: draft.title.trim(),
      date: draft.date,
      start,
      end,
      allDay: Boolean(draft.allDay || !start),
      color: draft.color ?? nextEventColor(allEvents.map((e) => e.color)),
      notes: draft.notes ?? '',
      location: draft.location ?? '',
      googleId: draft.googleId,
    }
    setBusy(true)
    try {
      if (draft.googleId && gcal.connected) {
        const saved = await gcal.saveToGoogle(payload)
        if (saved) syncFromCalendar([saved])
      } else if (!draft.id && toGoogle && gcal.connected) {
        try {
          const saved = await gcal.saveToGoogle(payload)
          addEvent({ ...payload, googleId: saved?.googleId })
        } catch {
          addEvent(payload)
        }
      } else if (draft.id) {
        updateEvent(draft.id, payload)
        if (toGoogle && gcal.connected && !draft.googleId) {
          try {
            const saved = await gcal.saveToGoogle(payload)
            if (saved?.googleId) updateEvent(draft.id, { googleId: saved.googleId })
          } catch {
            /* kept local */
          }
        }
      } else {
        addEvent(payload)
      }
      setDraft(null)
    } catch (err) {
      alert(friendlyGoogleError(err))
    } finally {
      setBusy(false)
    }
  }

  const openNew = (date: string, start?: string, end?: string) => {
    setToGoogle(state.settings.pushToGoogle && gcal.connected)
    const timed = Boolean(start)
    setDraft({
      title: '',
      date,
      start,
      end: timed ? end || minutesToStamp(minutesOf(start!) + 60) : undefined,
      allDay: !timed,
      color: nextEventColor(allEvents.map((e) => e.color)),
      notes: '',
      location: '',
    })
  }

  useEffect(() => {
    const g = takeCalGap()
    if (!g) return
    setCursor(parseISO(g.date))
    setView('day')
    const startMin = minutesOf(g.start)
    const endMin = g.end ? minutesOf(g.end) : startMin + 60
    setGap({ date: g.date, startMin, endMin })
    openNew(g.date, g.start, g.end)
    window.setTimeout(() => {
      const hour = Math.max(0, Math.min(23, Math.floor(startMin / 60)))
      document.querySelector(`[data-cal-hour="${hour}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 80)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        <ColorDots colors={PALETTE} value={draft.color ?? nextEventColor(allEvents.map((e) => e.color))} onChange={(color) => setDraft({ ...draft, color })} />
        {gcal.connected ? (
          draft.googleId ? (
            <p className="muted">This event lives on Google Calendar.</p>
          ) : (
            <label className="row">
              <input type="checkbox" checked={toGoogle} onChange={(e) => setToGoogle(e.target.checked)} />
              Also add to Google Calendar
            </label>
          )
        ) : null}
        <div className="row" style={{ justifyContent: 'space-between' }}>
          {draft.id ? (
            <button
              className="btn-danger"
              onClick={async () => {
                if (draft.googleId && gcal.connected) {
                  try {
                    await gcal.removeFromGoogle(draft.googleId)
                  } catch (err) {
                    alert(err instanceof Error ? err.message : 'Could not delete from Google')
                    return
                  }
                }
                if (draft.id && !draft.id.startsWith('gcal:')) deleteEvent(draft.id)
                if (draft.googleId) dropGoogleItems(draft.googleId)
                setDraft(null)
              }}
            >
              Delete
            </button>
          ) : (
            <span />
          )}
          <button className="btn" onClick={() => void save()} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
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
          <p className="kicker">{projectId ? `Project // ${state.projects.find((p) => p.id === projectId)?.name ?? 'filter'}` : 'Time-block schedule · drag to reschedule'}</p>
          <h1>{view === 'day' ? cursor.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : monthName(cursor)}</h1>
        </div>
        <div className="row">
          {gcal.connected ? (
            <button className="btn-ghost" onClick={() => void gcal.refresh(cursor, true)} disabled={gcal.loading}>
              <Icon name="google" size={16} /> {gcal.loading ? 'Syncing…' : 'Sync Google'}
            </button>
          ) : (
            <button className="btn-ghost" onClick={() => void gcal.connect()}>
              <Icon name="google" size={16} /> Link Google
            </button>
          )}
          <button className="btn" onClick={() => openNew(dayIso)}>
            <Icon name="plus" size={16} /> Event
          </button>
        </div>
      </header>
      {gcal.error ? <p className="muted" style={{ marginTop: -12 }}>{gcal.error}</p> : null}
      {gcal.connected && gcal.email ? <p className="muted" style={{ marginTop: -8 }}>Showing Google Calendar for {gcal.email}</p> : null}

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
            const cycle = state.goalCycles.find((x) => x.status === 'active')
            const mark = cycle
              ? (c.iso === checkpointDate(cycle, 30) && 'D30') ||
                (c.iso === checkpointDate(cycle, 60) && 'D60') ||
                (c.iso === checkpointDate(cycle, 90) && 'D90') ||
                (c.iso === cycle.endDate && 'Q END')
              : null
            return (
              <button
                key={c.iso}
                className={`cal-cell${c.inMonth ? '' : ' out'}${c.iso === today ? ' today' : ''}`}
                onClick={() => openNew(c.iso)}
              >
                <span className="day-num">{c.date.getDate()}</span>
                {mark ? <span className="kicker">{mark}</span> : null}
                {evs.slice(0, 3).map((e) => (
                  <span
                    key={e.id}
                    className={`pill${isDone(e) ? ' is-done' : ''}`}
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
          events={allEvents}
          onSlot={openNew}
          onEvent={(e) => setDraft({ ...e })}
          onMove={(e, date, start, end) => {
            setMoved((m) => ({ ...m, [e.id]: { date, start, end } }))
            if (!e.id.startsWith('gcal:')) updateEvent(e.id, { date, start, end, allDay: false })
            const task = state.tasks.find((t) => t.eventId === e.id || (e.googleId && t.googleId === e.googleId))
            if (task) updateTask(task.id, { due: date, dueTime: start })
            if (e.googleId && gcal.connected) {
              void gcal.saveToGoogle({ ...e, date, start, end, allDay: false }).catch(() => {
                /* local move already applied */
              })
            }
          }}
          gap={gap}
          isDone={isDone}
        />
      ) : null}

      {form}
    </div>
  )
}

type DragState = {
  event: CalEvent
  duration: number
  pointerId: number
  originX: number
  originY: number
  dragging: boolean
  iso: string
  start: number
}

function WeekGrid({
  days,
  events,
  onSlot,
  onEvent,
  onMove,
  gap,
  isDone,
}: {
  days: Date[]
  events: CalEvent[]
  onSlot: (iso: string, start?: string, end?: string) => void
  onEvent: (e: CalEvent) => void
  onMove: (e: CalEvent, date: string, start: string, end: string) => void
  gap: { date: string; startMin: number; endMin: number } | null
  isDone: (e: CalEvent) => boolean
}) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)

  const readSlot = (clientX: number, clientY: number, duration: number) => {
    const el = document.elementFromPoint(clientX, clientY)?.closest('[data-cal-day]') as HTMLElement | null
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const start = snapStart(clientY - rect.top, HOUR_PX, duration)
    return { iso: el.dataset.calDay!, start }
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drag || e.pointerId !== drag.pointerId) return
    const moved = Math.hypot(e.clientX - drag.originX, e.clientY - drag.originY)
    if (!drag.dragging && moved < 8) return
    const slot = readSlot(e.clientX, e.clientY, drag.duration)
    if (!slot) return
    setDrag((d) => (d ? { ...d, dragging: true, iso: slot.iso, start: slot.start } : d))
  }

  const onPointerUp = (e: ReactPointerEvent) => {
    if (!drag || e.pointerId !== drag.pointerId) return
    if (drag.dragging) {
      const end = drag.start + drag.duration
      onMove(drag.event, drag.iso, minutesToStamp(drag.start), minutesToStamp(end))
    } else onEvent(drag.event)
    setDrag(null)
  }

  return (
    <div
      ref={boardRef}
      className="week-board"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="week-allday" style={{ gridTemplateColumns: `64px repeat(${days.length}, 1fr)` }}>
        <div className="gutter">All day</div>
        {days.map((d) => {
          const iso = toISO(d)
          const all = events.filter((e) => e.date === iso && (e.allDay || !e.start))
          return (
            <div key={iso} className="gutter week-allday-cell" onClick={() => onSlot(iso)}>
              <div className="kicker">
                {d.toLocaleDateString(undefined, { weekday: 'short' })} {d.getDate()}
              </div>
              {all.map((e) => (
                <button
                  key={e.id}
                  className={`pill${isDone(e) ? ' is-done' : ''}`}
                  style={{ ['--c' as string]: e.color, display: 'block', marginTop: 4 }}
                  onClick={(ev) => {
                    ev.stopPropagation()
                    onEvent(e)
                  }}
                >
                  {e.title}
                </button>
              ))}
            </div>
          )
        })}
      </div>
      <div className="week-grid" style={{ gridTemplateColumns: `64px repeat(${days.length}, 1fr)` }}>
        <div className="week-hours">
          {HOURS.map((h) => (
            <div key={h} className="gutter week-hour-label" data-cal-hour={h} style={{ height: HOUR_PX }}>
              {`${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`}
            </div>
          ))}
        </div>
        {days.map((d) => (
          <DayColumn
            key={toISO(d)}
            iso={toISO(d)}
            events={events.filter((e) => e.date === toISO(d))}
            onSlot={onSlot}
            drag={drag}
            onDragStart={(ev, block) => {
              ev.stopPropagation()
              ev.preventDefault()
              boardRef.current?.setPointerCapture(ev.pointerId)
              setDrag({
                event: block.event,
                duration: block.end - block.start,
                pointerId: ev.pointerId,
                originX: ev.clientX,
                originY: ev.clientY,
                dragging: false,
                iso: toISO(d),
                start: block.start,
              })
            }}
            gap={gap}
            isDone={isDone}
          />
        ))}
      </div>
    </div>
  )
}

function DayColumn({
  iso,
  events,
  onSlot,
  drag,
  onDragStart,
  gap,
  isDone,
}: {
  iso: string
  events: CalEvent[]
  onSlot: (iso: string, start?: string, end?: string) => void
  drag: DragState | null
  onDragStart: (ev: ReactPointerEvent, block: ReturnType<typeof layoutTimedEvents>[number]) => void
  gap: { date: string; startMin: number; endMin: number } | null
  isDone: (e: CalEvent) => boolean
}) {
  const blocks = layoutTimedEvents(events)
  const inGap = (min: number) => Boolean(gap && iso === gap.date && min >= gap.startMin && min < gap.endMin)
  const ghost = drag?.dragging && drag.iso === iso ? drag : null
  return (
    <div
      className="day-col"
      data-cal-day={iso}
      style={{ height: HOURS.length * HOUR_PX }}
      onClick={(e) => {
        if (drag?.dragging) return
        if ((e.target as HTMLElement).closest('.event-block')) return
        const rect = e.currentTarget.getBoundingClientRect()
        const y = e.clientY - rect.top
        const snapped = snapStart(y, HOUR_PX, 60)
        onSlot(iso, minutesToStamp(snapped), minutesToStamp(snapped + 60))
      }}
    >
      {HOURS.map((h) => (
        <div key={h} className={`hour-line${inGap(h * 60) ? ' is-gap' : ''}`} style={{ height: HOUR_PX }} />
      ))}
      {blocks.map((b) => {
        const moving = drag?.event.id === b.event.id && drag.dragging
        const top = ((moving && drag.iso === iso ? drag.start : b.start) / 60) * HOUR_PX
        const height = Math.max(22, ((b.end - b.start) / 60) * HOUR_PX - 2)
        const width = `calc(${100 / b.cols}% - 4px)`
        const left = `calc(${(b.col / b.cols) * 100}% + 2px)`
        return (
          <button
            key={b.event.id}
            type="button"
            className={`event-block${moving ? ' is-dragging' : ''}${isDone(b.event) ? ' is-done' : ''}`}
            style={{
              top,
              height,
              left,
              width,
              zIndex: moving ? 8 : 2 + b.col,
              ['--c' as string]: b.event.color,
            }}
            onPointerDown={(ev) => onDragStart(ev, b)}
            onClick={(ev) => ev.stopPropagation()}
          >
            <strong>{b.event.title}</strong>
            <span className="muted">
              {formatTime(minutesToStamp(moving && drag.iso === iso ? drag.start : b.start))} –{' '}
              {formatTime(minutesToStamp((moving && drag.iso === iso ? drag.start : b.start) + (b.end - b.start)))}
            </span>
          </button>
        )
      })}
      {ghost && ghost.event.date !== iso ? (
        <div
          className="event-block is-ghost"
          style={{
            top: (ghost.start / 60) * HOUR_PX,
            height: Math.max(22, (ghost.duration / 60) * HOUR_PX - 2),
            left: 2,
            width: 'calc(100% - 4px)',
            ['--c' as string]: ghost.event.color,
          }}
        >
          <strong>{ghost.event.title}</strong>
        </div>
      ) : null}
    </div>
  )
}
