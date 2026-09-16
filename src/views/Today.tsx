import { Check } from '../components/ui'
import { Icon } from '../icons'
import { formatLong, formatTime, greeting, todayISO } from '../lib/dates'
import { habitDone, isHabitDue } from '../lib/habits'
import { mergeCalendars, useGoogleCalendar } from '../google'
import type { Route } from '../lib/types'
import { useStore } from '../store'
import { formatRemain, useTimer } from '../timer'
import { MorningRoutine } from './MorningRoutine'

export function Today({ go }: { go: (r: Route) => void }) {
  const { state, toggleTask, setHabitCount } = useStore()
  const gcal = useGoogleCalendar()
  const timer = useTimer()
  const today = todayISO()
  const due = state.tasks
    .filter((t) => {
      if (t.completed || !t.due) return false
      if (t.googleId || t.listId === 'calendar') return t.due === today
      return t.due <= today
    })
    .sort((a, b) => (a.due === b.due ? b.priority - a.priority : (a.due ?? '').localeCompare(b.due ?? '')))
  const nextEvent = mergeCalendars(state.events, gcal.events)
    .filter((e) => e.date === today)
    .sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''))[0]
  const habits = state.habits.filter((h) => !h.archived && isHabitDue(h, new Date()))

  return (
    <div className="today-page">
      <header className="page-head today-head">
        <div>
          <p className="kicker">{formatLong(today)}</p>
          <h1>{greeting(state.settings.name)}</h1>
        </div>
        <button className="btn-ghost" onClick={() => go('focus')}>
          <Icon name="focus" size={16} />
          {timer.running ? formatRemain(timer.remaining) : 'Focus'}
        </button>
      </header>

      <MorningRoutine date={today} />

      <section className="today-glance">
        <div>
          <button className="today-glance-label" onClick={() => go('tasks')}>
            Open <span>{due.length}</span>
          </button>
          {due.slice(0, 4).map((t) => (
            <div key={t.id} className="task-row">
              <Check on={false} onClick={() => toggleTask(t.id)} />
              <div className="task-title">{t.title}</div>
            </div>
          ))}
          {due.length === 0 ? <p className="muted">Clear.</p> : null}
        </div>
        <div>
          <button className="today-glance-label" onClick={() => go('habits')}>
            Habits
          </button>
          {habits.map((h) => {
            const on = habitDone(h, state.habitLogs, today)
            return (
              <div key={h.id} className="task-row">
                <Check on={on} onClick={() => setHabitCount(h.id, today, on ? 0 : h.target)} label={h.name} />
                <div className="task-title">{h.name}</div>
              </div>
            )
          })}
        </div>
        <div>
          <button className="today-glance-label" onClick={() => go('calendar')}>
            Next
          </button>
          {nextEvent ? (
            <p className="today-next">
              <span className="dot" style={{ background: nextEvent.color }} />
              {nextEvent.allDay || !nextEvent.start ? 'All day' : formatTime(nextEvent.start)} · {nextEvent.title}
            </p>
          ) : (
            <p className="muted">Nothing timed.</p>
          )}
        </div>
      </section>
    </div>
  )
}
