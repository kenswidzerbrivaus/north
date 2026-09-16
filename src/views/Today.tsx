import { useMemo, useState } from 'react'
import { Check } from '../components/ui'
import { hhmmFromMinutes, roundDown5, stashCalGap } from '../lib/cal-gap'
import { formatTime, minutesOf, parseISO, todayISO } from '../lib/dates'
import { habitDone, isHabitDue } from '../lib/habits'
import { quoteForDate } from '../lib/quotes'
import { mergeCalendars, useGoogleCalendar } from '../google'
import type { Route, Task } from '../lib/types'
import { useStore } from '../store'
import { formatRemain, useTimer } from '../timer'
import { MorningRoutine } from './MorningRoutine'

type CaptureKind = 'task' | 'note' | 'event' | 'delegate' | 'decision'

function sephoHello(name: string) {
  const h = new Date().getHours()
  const sir = name.trim() || 'sir'
  if (h < 5) return `Still online, ${sir}.`
  if (h < 12) return `Good morning, ${sir}.`
  if (h < 17) return `Good afternoon, ${sir}.`
  if (h < 21) return `Good evening, ${sir}.`
  return `Running quiet, ${sir}.`
}

function nowMinutes() {
  const n = new Date()
  return n.getHours() * 60 + n.getMinutes()
}

export function Today({ go }: { go: (r: Route) => void }) {
  const { state, toggleTask, updateTask, setHabitCount, addTask, addNote, addEvent } = useStore()
  const gcal = useGoogleCalendar()
  const timer = useTimer()
  const today = todayISO()
  const date = parseISO(today)
  const quote = quoteForDate(today)
  const [quick, setQuick] = useState('')
  const [kind, setKind] = useState<CaptureKind>('task')

  const clock = nowMinutes()
  const events = mergeCalendars(state.events, gcal.events)
    .filter((e) => e.date === today)
    .sort((a, b) => (a.start ?? '99').localeCompare(b.start ?? '99'))

  const todayTasks = state.tasks.filter((t) => t.due === today || (!t.completed && t.due && t.due < today && !t.googleId && t.listId !== 'calendar'))

  const linked = new Set(events.flatMap((e) => [e.id, e.googleId].filter(Boolean) as string[]))

  const queue = useMemo(() => {
    const rows: {
      id: string
      title: string
      time?: string
      done: boolean
      blocked: boolean
      kind: 'task' | 'event'
      taskId?: string
    }[] = []
    for (const e of events) {
      const task = state.tasks.find((t) => t.eventId === e.id || (e.googleId && t.googleId === e.googleId && t.due === today))
      rows.push({
        id: e.id,
        title: e.title,
        time: e.allDay || !e.start ? undefined : e.start,
        done: Boolean(task?.completed),
        blocked: Boolean(task?.blocked),
        kind: 'event',
        taskId: task?.id,
      })
    }
    for (const t of todayTasks) {
      if (t.eventId && linked.has(t.eventId)) continue
      if (t.googleId && linked.has(t.googleId)) continue
      if (t.decision || t.waitingOn) continue
      rows.push({
        id: t.id,
        title: t.title,
        time: t.dueTime,
        done: t.completed,
        blocked: Boolean(t.blocked),
        kind: 'task',
        taskId: t.id,
      })
    }
    return rows.sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99'))
  }, [events, linked, state.tasks, today, todayTasks])

  const openWork = queue.filter((r) => !r.done && !r.blocked)
  const nowRow =
    openWork.find((r) => r.taskId && r.taskId === timer.taskId) ??
    openWork.find((r) => r.time && minutesOf(r.time) <= clock) ??
    openWork[0]

  const overdue = state.tasks.filter((t) => !t.completed && t.due && t.due < today && !t.googleId).length
  const decisions = state.tasks.filter((t) => t.decision && !t.completed)
  const blocked = state.tasks.filter((t) => t.blocked && !t.completed)
  const waiting = state.tasks.filter((t) => t.waitingOn && !t.completed)
  const exec = Math.round((queue.filter((r) => r.done).length / Math.max(1, queue.length)) * 100)

  const habits = state.habits.filter((h) => !h.archived && isHabitDue(h, date))

  const nextTimed = events.find((e) => e.start && minutesOf(e.start) > clock)
  const opening = nextTimed?.start ? minutesOf(nextTimed.start) - clock : 24 * 60 - clock
  const sephoLine =
    opening > 20
      ? `You have a ${opening}-minute opening${nextTimed ? ` until ${nextTimed.title}` : ' before day close'}. Recommend deep work on the current objective.`
      : nextTimed
        ? `Next block is ${nextTimed.title} in ${opening} minutes. Prep now.`
        : 'Queue is clear. Recover or pull the next objective.'

  const capture = () => {
    const title = quick.trim()
    if (!title) return
    if (kind === 'note') addNote(title)
    else if (kind === 'event') addEvent({ title, date: today, allDay: true })
    else if (kind === 'delegate') {
      const [who, rest] = title.split(/—|-/).map((s) => s.trim())
      addTask({ title, due: today, waitingOn: rest ? who : title })
    } else if (kind === 'decision') addTask({ title, due: today, decision: true })
    else addTask({ title, due: today })
    setQuick('')
  }

  const markNow = (patch: Partial<Task>) => {
    if (nowRow?.taskId) updateTask(nowRow.taskId, patch)
  }

  return (
    <div className="board">
      <header className="board-head hud-frame">
        <div>
          <p className="sepho-sys">
            SEPHO // {gcal.connected ? 'CAL.LINKED' : 'CAL.LOCAL'} // {timer.running ? 'FOCUS.LIVE' : 'FOCUS.STANDBY'}
          </p>
          <div className="board-head-main">
            <span className="today-num">{date.getDate()}</span>
            <div>
              <p className="today-dow">{date.toLocaleDateString(undefined, { weekday: 'short', month: 'long' }).toUpperCase()}</p>
              <p className="board-hello">{sephoHello(state.settings.name)}</p>
            </div>
          </div>
          <p className="today-quote">
            “{quote.text}” <cite>// {quote.by}</cite>
          </p>
        </div>
        <div className="board-readouts">
          <div>
            <span className="kicker">Execution</span>
            <b>{exec}%</b>
          </div>
          <button className="today-focus hud-frame" onClick={() => go('focus')}>
            <span className="kicker">{timer.running ? 'Reactor' : 'Focus // Standby'}</span>
            <b>{formatRemain(timer.remaining)}</b>
          </button>
        </div>
      </header>

      <section className="board-morning hud-frame">
        <p className="board-label">Morning launch</p>
        <MorningRoutine date={today} compact />
      </section>

      <aside className="board-command">
        <section className="hud-frame">
          <p className="board-label warn">Needs attention</p>
          <p className="board-attn">
            {overdue} overdue · {decisions.length} decisions · {blocked.length} blocked
          </p>
        </section>
        <section className="hud-frame">
          <p className="board-label">Decisions</p>
          {decisions.length === 0 ? (
            <p className="today-empty">None open.</p>
          ) : (
            decisions.slice(0, 5).map((t) => (
              <button key={t.id} className="board-line" onClick={() => go('tasks')}>
                {t.title}
              </button>
            ))
          )}
        </section>
        <section className="hud-frame">
          <p className="board-label">Waiting on</p>
          {waiting.length === 0 ? (
            <p className="today-empty">Clear.</p>
          ) : (
            waiting.slice(0, 5).map((t) => (
              <p key={t.id} className="board-wait">
                <span>{t.waitingOn}</span>
                <span className="muted">{t.title}</span>
              </p>
            ))
          )}
        </section>
        <section className="hud-frame board-sepho">
          <p className="board-label">Sepho // Command</p>
          <p className="board-brief">{sephoLine}</p>
          <div className="row">
            <button
              className="btn"
              onClick={() => {
                if (nowRow?.taskId) timer.setTaskId(nowRow.taskId)
                timer.start()
                go('focus')
              }}
            >
              Accept
            </button>
            <button
              className="btn-ghost"
              onClick={() => {
                stashCalGap({
                  date: today,
                  start: hhmmFromMinutes(roundDown5(clock)),
                  end: nextTimed?.start,
                })
                go('calendar')
              }}
            >
              Adjust
            </button>
          </div>
        </section>
      </aside>

      <section className="board-now hud-frame">
        <p className="board-label">Now</p>
        {nowRow ? (
          <>
            <p className="now-star">★ {nowRow.title}</p>
            <p className="now-clock">{formatRemain(timer.remaining)}</p>
            <div className="row">
              <button
                className="btn"
                onClick={() => {
                  if (nowRow.taskId) timer.setTaskId(nowRow.taskId)
                  timer.running ? timer.pause() : timer.start()
                }}
              >
                {timer.running ? 'Pause' : 'Focus'}
              </button>
              <button
                className="btn-ghost"
                onClick={() => nowRow.taskId && toggleTask(nowRow.taskId)}
                disabled={!nowRow.taskId}
              >
                Done
              </button>
              <button
                className="btn-ghost"
                onClick={() => markNow({ blocked: true })}
                disabled={!nowRow.taskId}
              >
                Blocked
              </button>
            </div>
          </>
        ) : (
          <p className="today-empty">No active objective. Queue one below.</p>
        )}
      </section>

      <section className="board-queue hud-frame">
        <p className="board-label">Execution queue</p>
        <ol className="exec-queue">
          {queue.length === 0 ? (
            <li className="today-empty">Nothing scheduled today.</li>
          ) : (
            queue.map((row) => {
              const current = nowRow?.id === row.id
              const mark = row.done ? '✓' : row.blocked ? '●' : current ? '★' : '○'
              return (
                <li key={row.id} className={row.done ? 'is-done' : current ? 'is-now' : ''}>
                  <span className="today-time">{row.time ? formatTime(row.time) : '—'}</span>
                  <span className="exec-mark">{mark}</span>
                  <span>{row.title}</span>
                </li>
              )
            })
          )}
        </ol>
      </section>

      <section className="board-systems hud-frame">
        <button className="board-label as-btn" onClick={() => go('habits')}>
          Daily systems
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

      <section className="board-capture hud-frame">
        <p className="board-label">Quick capture</p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            capture()
          }}
        >
          <input
            className="input"
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            placeholder="> Type anything…"
          />
        </form>
        <div className="row capture-kinds">
          {(['task', 'note', 'event', 'delegate', 'decision'] as CaptureKind[]).map((k) => (
            <button key={k} className="chip" data-on={kind === k} onClick={() => setKind(k)}>
              {k}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
