import { Icon } from '../icons'
import { formatMedium, todayISO } from '../lib/dates'
import { requestNotify } from '../lib/sound'
import { useStore } from '../store'
import { formatRemain, useTimer } from '../timer'

export function Focus() {
  const { state } = useStore()
  const timer = useTimer()
  const r = 108
  const c = 2 * Math.PI * r
  const progress = 1 - timer.remaining / Math.max(1, timer.total)
  const openTasks = state.tasks.filter((t) => !t.completed).slice(0, 12)
  const todaySessions = state.sessions.filter((s) => s.endedAt.slice(0, 10) === todayISO())
  const focusMins = Math.round(
    todaySessions.filter((s) => s.mode === 'focus').reduce((n, s) => n + s.seconds, 0) / 60,
  )

  return (
    <div>
      <header className="page-head">
        <div>
          <p className="kicker">One thing at a time</p>
          <h1>Focus</h1>
        </div>
        <p className="muted">{focusMins} focused minutes today · round {timer.rounds}</p>
      </header>

      <div className="grid-2">
        <section className="card" style={{ padding: 28 }}>
          <div className="row" style={{ justifyContent: 'center', marginBottom: 8 }}>
            {(['focus', 'short', 'long'] as const).map((m) => (
              <button key={m} className="chip" data-on={timer.mode === m} onClick={() => timer.setMode(m)}>
                {m === 'focus' ? 'Focus' : m === 'short' ? 'Short break' : 'Long break'}
              </button>
            ))}
          </div>
          <div className="ring-wrap">
            <svg width="260" height="260" viewBox="0 0 260 260">
              <circle cx="130" cy="130" r={r} fill="none" stroke="var(--line)" strokeWidth="12" />
              <circle
                cx="130"
                cy="130"
                r={r}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={c * (1 - progress)}
                transform="rotate(-90 130 130)"
              />
            </svg>
            <div className="clock">
              <b>{formatRemain(timer.remaining)}</b>
              <p className="muted">{timer.running ? 'In session' : 'Ready'}</p>
            </div>
          </div>
          <div className="row" style={{ justifyContent: 'center', marginTop: 8 }}>
            <button
              className="btn"
              onClick={() => {
                requestNotify()
                timer.running ? timer.pause() : timer.start()
              }}
            >
              <Icon name={timer.running ? 'pause' : 'play'} size={16} />
              {timer.running ? 'Pause' : 'Start'}
            </button>
            <button className="btn-ghost" onClick={timer.reset}>
              Reset
            </button>
            <button className="btn-ghost" onClick={timer.skip}>
              <Icon name="skip" size={16} /> Skip
            </button>
          </div>
          <FieldSelect tasks={openTasks} value={timer.taskId} onChange={timer.setTaskId} />
        </section>

        <section className="card">
          <h2>Sessions</h2>
          {state.sessions.length === 0 ? (
            <p className="muted">Finished sessions land here. Start the timer to begin a streak of deep work.</p>
          ) : (
            state.sessions.slice(0, 16).map((s) => (
              <div key={s.id} className="agenda-row">
                <span className="dot" style={{ background: s.mode === 'focus' ? 'var(--accent)' : 'var(--forest)', marginTop: 6 }} />
                <div>
                  <div className="task-title">
                    {s.mode === 'focus' ? 'Focus' : s.mode === 'short' ? 'Short break' : 'Long break'} · {Math.round(s.seconds / 60)} min
                  </div>
                  <div className="meta">{formatMedium(s.endedAt.slice(0, 10))}</div>
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  )
}

function FieldSelect({
  tasks,
  value,
  onChange,
}: {
  tasks: { id: string; title: string }[]
  value?: string
  onChange: (id?: string) => void
}) {
  return (
    <label className="field" style={{ marginTop: 18 }}>
      <span>Working on</span>
      <select className="select" value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">No task linked</option>
        {tasks.map((t) => (
          <option key={t.id} value={t.id}>
            {t.title}
          </option>
        ))}
      </select>
    </label>
  )
}
