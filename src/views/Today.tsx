import { Check, Empty } from '../components/ui'
import { Icon } from '../icons'
import { addDays, formatLong, formatTime, greeting, toISO, todayISO } from '../lib/dates'
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
    .filter((t) => !t.completed && t.due && t.due <= today)
    .sort((a, b) => (a.due === b.due ? b.priority - a.priority : (a.due ?? '').localeCompare(b.due ?? '')))
  const events = mergeCalendars(state.events, gcal.events)
    .filter((e) => e.date === today)
    .sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''))
  const habits = state.habits.filter((h) => !h.archived && isHabitDue(h, new Date()))
  const remainingHabits = habits.filter((h) => !habitDone(h, state.habitLogs, today))
  const doneToday = state.tasks.filter((t) => t.completed && t.completedAt?.slice(0, 10) === today).length
  const focusMins = Math.round(
    state.sessions
      .filter((s) => s.mode === 'focus' && s.endedAt.slice(0, 10) === today)
      .reduce((n, s) => n + s.seconds, 0) / 60,
  )
  const bars = Array.from({ length: 7 }, (_, i) => {
    const key = toISO(addDays(new Date(), i - 6))
    return state.tasks.filter((t) => t.completedAt?.slice(0, 10) === key).length
  })
  const maxBar = Math.max(1, ...bars)

  return (
    <div>
      <header className="page-head">
        <div>
          <p className="kicker">{formatLong(today)}</p>
          <h1>{greeting(state.settings.name)}</h1>
        </div>
        <button className="btn" onClick={() => go('focus')}>
          <Icon name="play" size={16} /> Start focus
        </button>
      </header>

      <div className="grid-3" style={{ marginBottom: 16 }}>
        <div className="card stat">
          <span className="kicker">Open today</span>
          <b>{due.length}</b>
        </div>
        <div className="card stat">
          <span className="kicker">Habits left</span>
          <b>{remainingHabits.length}</b>
        </div>
        <div className="card stat">
          <span className="kicker">Focus minutes</span>
          <b>{focusMins}</b>
        </div>
      </div>

      <div style={{ marginBottom: 22 }}>
        <MorningRoutine date={today} />
      </div>

      <div className="grid-2">
        <div className="stack">
          <section className="card">
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <h2>Tasks</h2>
              <button className="btn-ghost" onClick={() => go('tasks')}>
                All tasks
              </button>
            </div>
            {due.length === 0 ? (
              <Empty title="Nothing due" body="You’re clear. Add a task when the next thing appears." />
            ) : (
              due.map((t) => (
                <div key={t.id} className="task-row">
                  <Check on={false} onClick={() => toggleTask(t.id)} />
                  <div>
                    <div className="task-title">{t.title}</div>
                    <div className="meta">
                      {t.due && t.due < today ? <span className="prio" data-p="3">Overdue</span> : null}
                      {t.priority ? (
                        <span className="prio" data-p={t.priority}>
                          {['', 'Low', 'Med', 'High'][t.priority]}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            )}
          </section>

          <section className="card">
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <h2>Agenda</h2>
              <button className="btn-ghost" onClick={() => go('calendar')}>
                Calendar
              </button>
            </div>
            {events.length === 0 ? (
              <p className="muted">No events on the calendar today.</p>
            ) : (
              events.map((e) => (
                <div key={e.id} className="agenda-row">
                  <span className="dot" style={{ background: e.color, marginTop: 6 }} />
                  <div>
                    <div className="task-title">{e.title}</div>
                    <div className="meta">
                      {e.allDay || !e.start ? 'All day' : formatTime(e.start)}
                      {e.location ? ` · ${e.location}` : ''}
                    </div>
                  </div>
                </div>
              ))
            )}
          </section>
        </div>

        <div className="stack">
          <section className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h2>Habits</h2>
              <button className="btn-ghost" onClick={() => go('habits')}>
                Tracker
              </button>
            </div>
            {habits.map((h) => {
              const on = habitDone(h, state.habitLogs, today)
              return (
                <div key={h.id} className="task-row">
                  <Check
                    on={on}
                    onClick={() => setHabitCount(h.id, today, on ? 0 : h.target)}
                    label={h.name}
                  />
                  <div className="task-title">{h.name}</div>
                </div>
              )
            })}
          </section>

          <section className="card ring-wrap" style={{ padding: 22 }}>
            <svg width="180" height="180" viewBox="0 0 180 180">
              <circle cx="90" cy="90" r="74" fill="none" stroke="var(--line)" strokeWidth="10" />
              <circle
                cx="90"
                cy="90"
                r="74"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 74}
                strokeDashoffset={2 * Math.PI * 74 * (1 - timer.remaining / Math.max(1, timer.total))}
                transform="rotate(-90 90 90)"
              />
            </svg>
            <div className="clock">
              <p className="kicker">{timer.mode === 'focus' ? 'Focus' : 'Break'}</p>
              <b>{formatRemain(timer.remaining)}</b>
              <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
                <button className="btn" onClick={timer.running ? timer.pause : timer.start}>
                  {timer.running ? 'Pause' : 'Start'}
                </button>
              </div>
            </div>
          </section>

          <section className="card">
            <p className="kicker">Done this week</p>
            <div className="bars" aria-hidden>
              {bars.map((n, i) => (
                <span key={i} style={{ height: `${(n / maxBar) * 100}%` }} title={`${n} tasks`} />
              ))}
            </div>
            <p className="muted" style={{ marginTop: 8 }}>
              {doneToday} finished today
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
