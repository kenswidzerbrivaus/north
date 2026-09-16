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

  const linked = new Set(
    events.flatMap((e) => [e.id, e.googleId].filter(Boolean) as string[]),
  )
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
        <div className="today-mast-date">
          <p className="today-dow">{date.toLocaleDateString(undefined, { weekday: 'long' })}</p>
          <div className="today-mast-row">
            <span className="today-num">{date.getDate()}</span>
            <span className="today-mon">{date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
          </div>
        </div>
        <button className="today-focus" onClick={() => go('focus')}>
          <span className="kicker">{timer.running ? 'In session' : 'Focus'}</span>
          <b>{formatRemain(timer.remaining)}</b>
        </button>
      </header>

      <p className="today-quote">
        “{quote.text}”
        <cite>{quote.by}</cite>
      </p>

      <MorningRoutine date={today} />

      <div className="today-ledger">
        <section>
          <button className="today-col-head" onClick={() => go('tasks')}>
            The work <span>{work.length}</span>
          </button>
          <ol className="today-order">
            {work.length === 0 ? (
              <li className="today-empty">Nothing due. Add one below or rest.</li>
            ) : (
              work.map((row, i) => (
                <li key={row.id} className="today-item">
                  <span className="today-idx">{String(i + 1).padStart(2, '0')}</span>
                  <span className="today-time">{row.time ? formatTime(row.time) : '—'}</span>
                  {row.kind === 'task' ? (
                    <Check on={false} onClick={() => toggleTask(row.id)} />
                  ) : (
                    <span className="dot" style={{ background: row.color, marginTop: 6 }} />
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
              placeholder="Add to today and press Enter"
            />
          </form>
        </section>

        <section>
          <button className="today-col-head" onClick={() => go('habits')}>
            Rituals <span>{habitsLeft}</span>
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
            {habits.length === 0 ? <li className="today-empty">No rituals due.</li> : null}
          </ul>
        </section>
      </div>
    </div>
  )
}
