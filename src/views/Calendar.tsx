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
import { nextEventColor, PALETTE, type CalEvent } from '../lib/types'
import { useStore } from '../store'

type View = 'month' | 'week' | 'day'

const HOURS = Array.from({ length: 24 }, (_, i) => i)

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
  const allEvents = useMemo(() => mergeCalendars(state.events, gcal.events), [gcal.events, state.events])

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
    const payload = {
      title: draft.title.trim(),
      date: draft.date,
      start: draft.start,
      end: draft.end,
      allDay: Boolean(draft.allDay || !draft.start),
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
    setDraft({
      title: '',
      date,
      start,
      end,
      allDay: !start,
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
          <p className="kicker">Time on a page</p>
          <h1>{view === 'day' ? cursor.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : monthName(cursor)}</h1>
        </div>
        <div className="row">
          {gcal.connected ? (
            <button className="btn-ghost" onClick={() => void gcal.refresh(cursor)} disabled={gcal.loading}>
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
        <HourRow key={h} hour={h} isos={isos} events={events} onSlot={onSlot} onEvent={onEvent} gap={gap} />
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
  gap,
}: {
  hour: number
  isos: string[]
  events: CalEvent[]
  onSlot: (iso: string, start?: string, end?: string) => void
  onEvent: (e: CalEvent) => void
  gap: { date: string; startMin: number; endMin: number } | null
}) {
  const label = `${hour % 12 || 12} ${hour < 12 ? 'AM' : 'PM'}`
  const stamp = `${String(hour).padStart(2, '0')}:00`
  const hourStart = hour * 60
  const hourEnd = hourStart + 60
  return (
    <>
      <div className="gutter" data-cal-hour={hour}>
        {label}
      </div>
      {isos.map((iso) => {
        const timed = events.filter((e) => e.date === iso && e.start && Math.floor(minutesOf(e.start) / 60) === hour)
        const inGap = Boolean(gap && iso === gap.date && hourStart < gap.endMin && hourEnd > gap.startMin)
        return (
          <button
            key={iso + hour}
            className={`hour-cell${inGap ? ' is-gap' : ''}`}
            data-cal-hour={hour}
            onClick={() => onSlot(iso, stamp)}
          >
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
                    ['--c' as string]: e.color,
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
