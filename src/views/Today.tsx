import { useState } from 'react'
import { Check } from '../components/ui'
import { formatTime, parseISO, todayISO } from '../lib/dates'
import { habitDone, isHabitDue } from '../lib/habits'
import { quoteForDate } from '../lib/quotes'
import { mergeCalendars, useGoogleCalendar } from '../google'
import type { Route } from '../lib/types'
import { useStore } from '../store'
import { formatRemain, useTimer } from '../timer'
import { MorningRoutine } from './MorningRoutine'

function sephoHello(name: string) {
  const h = new Date().getHours()
  const sir = name.trim() || 'sir'
  if (h < 5) return `Still online, ${sir}.`
  if (h < 12) return `Good morning, ${sir}.`
  if (h < 17) return `Good afternoon, ${sir}.`
  if (h < 21) return `Good evening, ${sir}.`
  return `Running quiet, ${sir}.`
}

export function Today({ go }: { go: (r: Route) => void }) {
  const { state, toggleTask, setHabitCount, addTask } = useStore()
  const gcal = useGoogleCalendar()
  const timer = useTimer()
  const today = todayISO()
  const date = parseISO(today)
  const quote = quoteForDate(today)
  const [quick, setQuick] = useState('')

  const events = mergeCalendars(state.events, gcal.events)
    .filter((e) => e.date === today)
    .sort((a, b) => (a.start ?? '99').localeCompare(b.start ?? '99'))

  const linked = new Set(events.flatMap((e) => [e.id, e.googleId].filter(Boolean) as string[]))
  const tasks = state.tasks
    .filter((t) => {
      if (t.completed || !t.due) return false
      if (t.eventId && linked.has(t.eventId)) return false
      if (t.googleId && linked.has(t.googleId)) return false
      if (t.googleId || t.listId === 'calendar') return t.due === today
      return t.due <= today
    })
    .sort((a, b) => (a.dueTime ?? '99').localeCompare(b.dueTime ?? '99'))

  const work = [
    ...events.map((e) => ({
      id: e.id,
      title: e.title,
      time: e.allDay || !e.start ? undefined : e.start,
      color: e.color,
      kind: 'event' as const,
    })),
    ...tasks.map((t) => ({
      id: t.id,
      title: t.title,
      time: t.dueTime,
      color: undefined as string | undefined,
      kind: 'task' as const,
    })),
  ].sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99'))

  const habits = state.habits.filter((h) => !h.archived && isHabitDue(h, date))
  const habitsLeft = habits.filter((h) => !habitDone(h, state.habitLogs, today)).length

  return (
    <div className="today-page">
      <header className="today-mast">
        <div>
          <p className="sepho-sys">
            SEPHO // {gcal.connected ? 'CAL.LINKED' : 'CAL.LOCAL'} // {timer.running ? 'FOCUS.LIVE' : 'FOCUS.IDLE'}
          </p>
          <p className="today-dow">{sephoHello(state.settings.name)}</p>
          <div className="today-mast-row">
            <span className="today-num">{date.getDate()}</span>
            <span className="today-mon">
              {date.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()}
              <br />
              {date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }).toUpperCase()}
            </span>
          </div>
        </div>
        <button className="today-focus hud-frame" onClick={() => go('focus')}>
          <span className="kicker">{timer.running ? 'Reactor' : 'Standby'}</span>
          <b>{formatRemain(timer.remaining)}</b>
        </button>
      </header>

      <p className="today-quote">
        “{quote.text}”
        <cite>// {quote.by}</cite>
      </p>

      <MorningRoutine date={today} />

      <div className="today-ledger">
        <section className="hud-frame">
          <button className="today-col-head" onClick={() => go('tasks')}>
            Active objectives <span>{String(work.length).padStart(2, '0')}</span>
          </button>
          <ol className="today-order">
            {work.length === 0 ? (
              <li className="today-empty">No objectives queued.</li>
            ) : (
              work.map((row, i) => (
                <li key={row.id} className="today-item">
                  <span className="today-idx">{String(i + 1).padStart(2, '0')}</span>
                  <span className="today-time">{row.time ? formatTime(row.time) : '—'}</span>
                  {row.kind === 'task' ? (
                    <Check on={false} onClick={() => toggleTask(row.id)} />
                  ) : (
                    <span className="dot" style={{ background: row.color ?? '#6ee7ff', marginTop: 6 }} />
                  )}
                  <button
                    className="today-item-title"
                    onClick={() => go(row.kind === 'task' ? 'tasks' : 'calendar')}
                  >
                    {row.title}
                  </button>
                </li>
              ))
            )}
          </ol>
          <form
            className="today-add"
            onSubmit={(e) => {
              e.preventDefault()
              const title = quick.trim()
              if (!title) return
              addTask({ title, due: today })
              setQuick('')
            }}
          >
            <input
              className="input"
              value={quick}
              onChange={(e) => setQuick(e.target.value)}
              placeholder="Queue objective — Enter"
            />
          </form>
        </section>

        <section className="hud-frame">
          <button className="today-col-head" onClick={() => go('habits')}>
            Daily systems <span>{String(habitsLeft).padStart(2, '0')}</span>
          </button>
          <ul className="today-rituals">
            {habits.map((h) => {
              const on = habitDone(h, state.habitLogs, today)
              return (
                <li key={h.id}>
                  <Check on={on} onClick={() => setHabitCount(h.id, today, on ? 0 : h.target)} label={h.name} />
                  <span className={on ? 'muted' : undefined}>{h.name}</span>
                </li>
              )
            })}
            {habits.length === 0 ? <li className="today-empty">No systems scheduled.</li> : null}
          </ul>
        </section>
      </div>
    </div>
  )
}
