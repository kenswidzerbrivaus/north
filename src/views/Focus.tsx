import { useEffect, useState } from 'react'
import { Field } from '../components/ui'
import { Icon } from '../icons'
import { formatMedium, localDay, shiftISO, todayISO } from '../lib/dates'
import { hashParam } from '../lib/route'
import { sortTasksChronological } from '../lib/task-sort'
import { useStore } from '../store'
import { formatRemain, useTimer } from '../timer'
import { activeProfile, attentionRange, detoxActive, detoxStreak, quietBadge, quietStreak } from '../lib/attention'

const FOCUS_PRESETS = [15, 25, 45, 50, 90]

function clamp(n: number, min: number, max: number) {
  const v = Number.isFinite(n) ? n : min
  return Math.max(min, Math.min(max, Math.round(v)))
}

export function Focus() {
  const { state, updateSettings } = useStore()
  const timer = useTimer()
  const s = state.settings
  const r = 108
  const c = 2 * Math.PI * r
  const progress = 1 - timer.remaining / Math.max(1, timer.total)
  const openTasks = (() => {
    const ranked = sortTasksChronological(state.tasks.filter((t) => !t.completed))
    const keep = timer.taskId
    const rows = ranked.slice(0, 12)
    if (keep && !rows.some((t) => t.id === keep)) {
      const extra = ranked.find((t) => t.id === keep)
      if (extra) return [...rows.slice(0, 11), extra]
    }
    return rows
  })()
  const [projectId, setProjectId] = useState(() => hashParam('project'))
  const [goalId, setGoalId] = useState(() => hashParam('goal'))
  useEffect(() => {
    const on = () => {
      setProjectId(hashParam('project'))
      setGoalId(hashParam('goal'))
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const todaySessions = state.sessions.filter(
    (sess) =>
      localDay(sess.endedAt) === todayISO() &&
      (!projectId || sess.projectId === projectId) &&
      (!goalId || sess.goalId === goalId),
  )
  const focusMins = Math.round(
    todaySessions.filter((sess) => sess.mode === 'focus').reduce((n, sess) => n + sess.seconds, 0) / 60,
  )
  const locked = timer.running
  const activeMinutes = timer.mode === 'focus' ? s.focusMinutes : timer.mode === 'short' ? s.shortBreak : s.longBreak
  const activeMax = timer.mode === 'focus' ? 180 : timer.mode === 'short' ? 60 : 90

  const setActiveMinutes = (n: number) => {
    if (locked) return
    const minutes = clamp(n, 1, activeMax)
    if (timer.mode === 'focus') updateSettings({ focusMinutes: minutes })
    else if (timer.mode === 'short') updateSettings({ shortBreak: minutes })
    else updateSettings({ longBreak: minutes })
  }

  return (
    <div>
      <header className="page-head page-head-route">
        <div>
          <p className="kicker">One thing at a time</p>
          <h1>Focus</h1>
        </div>
        <p className="muted">
          {focusMins} focused minutes today · round {timer.rounds}
        </p>
      </header>

      <div className="grid-2">
        <section className="card" style={{ padding: 28 }}>
          <div className="row" style={{ justifyContent: 'center', marginBottom: 8 }}>
            {(['focus', 'short', 'long'] as const).map((m) => (
              <button key={m} className="chip" data-on={timer.mode === m} onClick={() => timer.setMode(m)} disabled={locked}>
                {m === 'focus' ? `Focus ${s.focusMinutes}m` : m === 'short' ? `Short ${s.shortBreak}m` : `Long ${s.longBreak}m`}
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
              <p className="muted">{timer.running ? 'In session' : `${activeMinutes} minute ${timer.mode === 'focus' ? 'focus' : 'break'}`}</p>
            </div>
          </div>

          <div className="row" style={{ justifyContent: 'center', marginTop: 4 }}>
            <button className="btn-icon" disabled={locked} onClick={() => setActiveMinutes(activeMinutes - 1)} aria-label="Minus one minute">
              −
            </button>
            <label className="field" style={{ width: 88, textAlign: 'center' }}>
              <span>Minutes</span>
              <input
                className="input"
                type="number"
                min={1}
                max={activeMax}
                disabled={locked}
                value={activeMinutes}
                onChange={(e) => setActiveMinutes(Number(e.target.value))}
              />
            </label>
            <button className="btn-icon" disabled={locked} onClick={() => setActiveMinutes(activeMinutes + 1)} aria-label="Plus one minute">
              +
            </button>
          </div>

          {timer.mode === 'focus' ? (
            <div className="row" style={{ justifyContent: 'center', marginTop: 10 }}>
              {FOCUS_PRESETS.map((n) => (
                <button
                  key={n}
                  className="chip"
                  data-on={s.focusMinutes === n}
                  disabled={locked}
                  onClick={() => {
                    timer.setMode('focus')
                    updateSettings({ focusMinutes: n })
                  }}
                >
                  {n}m
                </button>
              ))}
            </div>
          ) : null}

          {locked ? <p className="muted" style={{ textAlign: 'center' }}>Pause or reset to change the length.</p> : null}

          <div className="row" style={{ justifyContent: 'center', marginTop: 12 }}>
            <button
              className="btn"
              onClick={() => {
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

        <div className="stack">
          <section className="card stack">
            <h2>Customize</h2>
            <p className="muted">These stay saved on this device.</p>
            <Field label="Focus minutes">
              <input
                className="input"
                type="number"
                min={1}
                max={180}
                disabled={locked && timer.mode === 'focus'}
                value={s.focusMinutes}
                onChange={(e) => updateSettings({ focusMinutes: clamp(Number(e.target.value), 1, 180) })}
              />
            </Field>
            <Field label="Short break">
              <input
                className="input"
                type="number"
                min={1}
                max={60}
                disabled={locked && timer.mode === 'short'}
                value={s.shortBreak}
                onChange={(e) => updateSettings({ shortBreak: clamp(Number(e.target.value), 1, 60) })}
              />
            </Field>
            <Field label="Long break">
              <input
                className="input"
                type="number"
                min={1}
                max={90}
                disabled={locked && timer.mode === 'long'}
                value={s.longBreak}
                onChange={(e) => updateSettings({ longBreak: clamp(Number(e.target.value), 1, 90) })}
              />
            </Field>
            <Field label="Focus rounds until a long break">
              <input
                className="input"
                type="number"
                min={1}
                max={12}
                value={s.roundsUntilLong}
                onChange={(e) => updateSettings({ roundsUntilLong: clamp(Number(e.target.value), 1, 12) })}
              />
            </Field>
            <label className="row">
              <input type="checkbox" checked={s.sound} onChange={(e) => updateSettings({ sound: e.target.checked })} />
              Play a chime when a session ends
            </label>
            <label className="row">
              <input type="checkbox" checked={s.autoBreaks} onChange={(e) => updateSettings({ autoBreaks: e.target.checked })} />
              Auto-start breaks
            </label>
          </section>

          <FocusProfiles />

          <AttentionStats />

          <section className="card">
            <h2>Sessions</h2>
            {state.sessions.length === 0 ? (
              <p className="muted">Finished sessions land here. Start the timer to begin a streak of deep work.</p>
            ) : (
              state.sessions.filter((sess) => (!projectId || sess.projectId === projectId) && (!goalId || sess.goalId === goalId)).slice(0, 16).map((sess) => (
                <div key={sess.id} className="agenda-row">
                  <span
                    className="dot"
                    style={{ background: sess.mode === 'focus' ? 'var(--accent)' : 'var(--forest)', marginTop: 6 }}
                  />
                  <div>
                    <div className="task-title">
                      {sess.mode === 'focus' ? 'Focus' : sess.mode === 'short' ? 'Short break' : 'Long break'} ·{' '}
                      {Math.round(sess.seconds / 60)} min
                    </div>
                    <div className="meta">{formatMedium(localDay(sess.endedAt) || todayISO())}</div>
                  </div>
                </div>
              ))
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function FocusProfiles() {
  const { state, updateAttention } = useStore()
  const now = new Date()
  const current = activeProfile(state.attention, now)
  return (
    <section className="card stack">
      <h2>Profiles</h2>
      <p className="muted">
        A profile picks a Space and extra locks. The timer above stays the same session clock. Edit schedules in Settings.
      </p>
      {current ? <p className="kicker">Now: {current.name}</p> : <p className="kicker">No profile running</p>}
      {state.attention.profiles.map((p) => {
        const on = state.attention.activeProfileId === p.id
        return (
          <div key={p.id} className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <div className="task-title">{p.name}</div>
              <div className="meta">
                {p.enabled ? 'Scheduled' : 'Manual'}
                {on ? ' · active' : ''}
              </div>
            </div>
            <button
              type="button"
              className="chip"
              data-on={on}
              onClick={() =>
                updateAttention({
                  activeProfileId: on ? undefined : p.id,
                  activeSpaceId: on ? state.attention.activeSpaceId : p.spaceId,
                })
              }
            >
              {on ? 'Stop' : 'Start'}
            </button>
          </div>
        )
      })}
    </section>
  )
}

function AttentionStats() {
  const { state } = useStore()
  const today = todayISO()
  const weekFrom = shiftISO(today, -6)
  const day = attentionRange(state.attention, today, today)
  const week = attentionRange(state.attention, weekFrom, today)
  const streak = quietStreak(state.attention, today)
  const dStreak = detoxStreak(state.attention, today)
  const badge = quietBadge(streak)
  const totalDay = Math.max(1, day.essentialMin + day.otherMin)
  return (
    <section className="card stack">
      <h2>Attention</h2>
      <p className="muted">Time in this app, on this device. Absence is the point.</p>
      <p className="kicker">Today</p>
      <p>
        {day.essentialMin} min essential · {day.otherMin} min other
      </p>
      <div className="attn-bar" aria-hidden>
        <span style={{ width: `${(day.essentialMin / totalDay) * 100}%` }} />
      </div>
      <p className="kicker">This week</p>
      <p>
        {week.essentialMin} min essential · {week.otherMin} min other · {week.lockedOpens} locked opens · {week.bypasses}{' '}
        skips
      </p>
      <p className="muted">
        {streak} quiet day{streak === 1 ? '' : 's'}
        {badge ? ` · ${badge}` : ''}
        {dStreak ? ` · ${dStreak} detox` : ''}
        {detoxActive(state.attention.detox) ? ' · detox on' : ''}
      </p>
    </section>
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
