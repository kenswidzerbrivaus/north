import { useEffect, useMemo, useState } from 'react'
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
import { layoutTimedEvents, minutesToStamp } from '../lib/cal-layout'
import { checkpointDate } from '../lib/goal-engine'
import { hashParam } from '../lib/route'
import { nextEventColor, PALETTE, type CalEvent } from '../lib/types'
import { useStore } from '../store'

type View = 'month' | 'week' | 'day'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const HOUR_PX = 56

export function Calendar() {
  const { state, addEvent, updateEvent, deleteEvent, syncFromCalendar, dropGoogleItems } = useStore()
  const gcal = useGoogleCalendar()
  const weekStartsOn = state.settings.weekStartsOn
  const [cursor, setCursor] = useState(() => new Date())
  const [view, setView] = useState<View>('month')
  const [draft, setDraft] = useState<Partial<CalEvent> | null>(null)
  const [toGoogle, setToGoogle] = useState(true)
  const [busy, setBusy] = useState(false)
  const [gap, setGap] = useState<{ date: string; startMin: number; endMin: number } | null>(null)
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
    if (!projectId) return merged
    const ids = new Set(
      state.tasks.filter((t) => t.projectId === projectId).flatMap((t) => [t.eventId, t.googleId].filter(Boolean) as string[]),
    )
    const proj = state.projects.find((p) => p.id === projectId)
    const needle = (proj?.name ?? '').toLowerCase()
    return merged.filter(
      (e) => ids.has(e.id) || (e.googleId && ids.has(e.googleId)) || (needle && e.title.toLowerCase().includes(needle.slice(0, 8))),
    )
  }, [merged, projectId, state.projects, state.tasks])

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
        } catch (err) {
          addEvent(payload)
          throw err
        }
      } else if (draft.id) {
        updateEvent(draft.id, payload)
        if (toGoogle && gcal.connected && !draft.googleId) {
          const saved = await gcal.saveToGoogle(payload)
          if (saved?.googleId) updateEvent(draft.id, { googleId: saved.googleId })
        }
      } else {
        addEvent(payload)
      }
      setDraft(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not save the event')
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
          <p className="kicker">{projectId ? `Project // ${state.projects.find((p) => p.id === projectId)?.name ?? 'filter'}` : 'Time-block schedule'}</p>
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
          events={allEvents}
          onSlot={openNew}
          onEvent={(e) => setDraft({ ...e })}
          gap={gap}
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
  gap,
}: {
  days: Date[]
  events: CalEvent[]
  onSlot: (iso: string, start?: string, end?: string) => void
  onEvent: (e: CalEvent) => void
  gap: { date: string; startMin: number; endMin: number } | null
}) {
  return (
    <div className="week-board">
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
                  className="pill"
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
            onEvent={onEvent}
            gap={gap}
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
  onEvent,
  gap,
}: {
  iso: string
  events: CalEvent[]
  onSlot: (iso: string, start?: string, end?: string) => void
  onEvent: (e: CalEvent) => void
  gap: { date: string; startMin: number; endMin: number } | null
}) {
  const blocks = layoutTimedEvents(events)
  const inGap = (min: number) => Boolean(gap && iso === gap.date && min >= gap.startMin && min < gap.endMin)
  return (
    <div
      className="day-col"
      style={{ height: HOURS.length * HOUR_PX }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('.event-block')) return
        const rect = e.currentTarget.getBoundingClientRect()
        const y = e.clientY - rect.top
        const snapped = Math.max(0, Math.min(24 * 60 - 30, Math.floor(y / (HOUR_PX / 2)) * 30))
        onSlot(iso, minutesToStamp(snapped), minutesToStamp(snapped + 60))
      }}
    >
      {HOURS.map((h) => (
        <div key={h} className={`hour-line${inGap(h * 60) ? ' is-gap' : ''}`} style={{ height: HOUR_PX }} />
      ))}
      {blocks.map((b) => {
        const top = (b.start / 60) * HOUR_PX
        const height = Math.max(22, ((b.end - b.start) / 60) * HOUR_PX - 2)
        const width = `calc(${100 / b.cols}% - 4px)`
        const left = `calc(${(b.col / b.cols) * 100}% + 2px)`
        return (
          <button
            key={b.event.id}
            type="button"
            className="event-block"
            style={{
              top,
              height,
              left,
              width,
              zIndex: 2 + b.col,
              ['--c' as string]: b.event.color,
            }}
            onClick={(ev) => {
              ev.stopPropagation()
              onEvent(b.event)
            }}
          >
            <strong>{b.event.title}</strong>
            <span className="muted">
              {formatTime(minutesToStamp(b.start))} – {formatTime(minutesToStamp(b.end))}
            </span>
          </button>
        )
      })}
    </div>
  )
}
