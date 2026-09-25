import { useMemo, useState } from 'react'
import { DayClock } from '../components/DayClock'
import { Continuance } from '../components/Continuance'
import { Check } from '../components/ui'
import { hhmmFromMinutes, roundDown5, stashCalGap } from '../lib/cal-gap'
import { formatTime, minutesOf, parseISO, shiftISO, todayISO } from '../lib/dates'
import { habitDone, isHabitDue } from '../lib/habits'
import { linkedGoalId } from '../lib/goal-engine'
import { exceptions, pendingDecisions, pickNow } from '../lib/project-engine'
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
  const { state, updateTask, toggleTask, setHabitCount, addTask, addNote, addEvent, resolveDecision, resolveWaiting } = useStore()
  const [cont, setCont] = useState<string | null>(null)
  const gcal = useGoogleCalendar()
  const timer = useTimer()
  const today = todayISO()
  const yesterday = shiftISO(today, -1)
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
  const nowPick = pickNow(state, clock)
  const nowRow =
    openWork.find((r) => r.taskId && r.taskId === timer.taskId) ??
    (nowPick?.taskId ? openWork.find((r) => r.taskId === nowPick.taskId) : undefined) ??
    openWork.find((r) => r.time && minutesOf(r.time) <= clock) ??
    openWork[0]
  const nowFallback = !nowRow && nowPick
    ? { id: nowPick.id, title: nowPick.title, done: false, blocked: false, kind: 'task' as const, taskId: nowPick.taskId, time: nowPick.time }
    : null
  const nowShow = nowRow ?? nowFallback
  const nowProject = nowPick?.projectName

  const overdue = state.tasks.filter((t) => !t.completed && t.due && t.due < today && !t.googleId).length
  const decisions = [
    ...state.tasks.filter((t) => t.decision && !t.completed),
    ...pendingDecisions(state.projectDecisions),
  ]
  const blocked = state.tasks.filter((t) => t.blocked && !t.completed)
  const waiting = [
    ...state.tasks.filter((t) => t.waitingOn && !t.completed).map((t) => ({ id: t.id, person: t.waitingOn!, title: t.title, projectId: t.projectId, kind: 'task' as const })),
    ...state.waitingOnItems
      .filter((w) => w.status === 'open' || w.status === 'overdue')
      .map((w) => ({ id: w.id, person: w.person, title: w.deliverable, projectId: w.projectId, kind: 'wait' as const })),
  ]
  const attn = exceptions(state)
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
    if (nowShow?.taskId) updateTask(nowShow.taskId, patch)
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
        </div>
        <div className="board-readouts">
          <div>
            <span className="kicker">Execution</span>
            <b>{exec}%</b>
          </div>
          <DayClock />
          <DayClock compact />
          <button className="today-focus hud-frame" onClick={() => go('focus')}>
            <span className="kicker">{timer.running ? 'Reactor' : 'Focus // Standby'}</span>
            <b>{formatRemain(timer.remaining)}</b>
          </button>
        </div>
        <p className="today-quote">
          “{quote.text}” <cite>// {quote.by}</cite>
        </p>
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
            {attn.length ? ` · ${attn.length} project exceptions` : ''}
          </p>
          {attn.slice(0, 3).map((a) => (
            <button key={a.id} className="board-line" onClick={() => { location.hash = `#/projects/${a.projectId}` }}>
              {a.title} — {a.detail}
            </button>
          ))}
        </section>
        <section className="hud-frame">
          <p className="board-label">Decisions</p>
          {decisions.length === 0 ? (
            <p className="today-empty">None open.</p>
          ) : (
            decisions.slice(0, 5).map((t) => (
              <button
                key={t.id}
                className="board-line"
                onClick={() => {
                  if ('projectId' in t && t.projectId && !('listId' in t)) location.hash = `#/projects/${t.projectId}`
                  else go('tasks')
                }}
              >
                {t.title}
                {'status' in t && t.status === 'pending' ? (
                  <span
                    className="chip"
                    onClick={(e) => {
                      e.stopPropagation()
                      resolveDecision(t.id, 'approved', 'Approved from Today')
                    }}
                  >
                    Approve
                  </span>
                ) : null}
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
              <button
                key={t.id}
                className="board-wait"
                onClick={() => {
                  if (t.projectId) location.hash = `#/projects/${t.projectId}`
                }}
              >
                <span>{t.person}</span>
                <span className="muted">{t.title}</span>
                {t.kind === 'wait' ? (
                  <span
                    className="chip"
                    onClick={(e) => {
                      e.stopPropagation()
                      resolveWaiting(t.id)
                    }}
                  >
                    Received
                  </span>
                ) : null}
              </button>
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
        {nowShow ? (
          <>
            {nowProject ? <p className="kicker">{nowProject}</p> : null}
            {nowShow.taskId ? (
              <GoalContext taskId={nowShow.taskId} />
            ) : null}
            <p className="now-star">★ {nowShow.title}</p>
            {nowPick?.label ? <p className="muted">{nowPick.label}</p> : null}
            <p className="now-clock">{formatRemain(timer.remaining)}</p>
            <div className="row">
              <button
                className="btn"
                onClick={() => {
                  if (nowShow.taskId) timer.setTaskId(nowShow.taskId)
                  timer.running ? timer.pause() : timer.start()
                }}
              >
                {timer.running ? 'Pause' : 'Enter focus'}
              </button>
              <button
                className="btn-ghost"
                onClick={() => nowShow.taskId && setCont(nowShow.taskId)}
                disabled={!nowShow.taskId}
              >
                Done
              </button>
              <button
                className="btn-ghost"
                onClick={() => markNow({ blocked: true })}
                disabled={!nowShow.taskId}
              >
                Blocked
              </button>
            </div>
          </>
        ) : (
          <p className="today-empty">No active objective. Queue one below.</p>
        )}
      </section>

      {state.tasks.filter((t) => !t.completed && t.due === yesterday).length ? (
        <section className="board-queue hud-frame">
          <p className="board-label">Close yesterday</p>
          <ul className="today-rituals">
            {state.tasks
              .filter((t) => !t.completed && t.due === yesterday)
              .map((t) => (
                <li key={t.id}>
                  <Check on={false} onClick={() => toggleTask(t.id)} label={t.title} />
                  <span>{t.title}</span>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <section className="board-queue hud-frame">
        <p className="board-label">Execution queue</p>
        <ol className="exec-queue">
          {queue.length === 0 ? (
            <li className="today-empty">Nothing scheduled today.</li>
          ) : (
            queue.map((row) => {
              const current = nowShow?.id === row.id
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
      {cont && state.tasks.find((t) => t.id === cont) ? (
        <Continuance task={state.tasks.find((t) => t.id === cont)!} onClose={() => setCont(null)} />
      ) : null}
    </div>
  )
}

function GoalContext({ taskId }: { taskId: string }) {
  const { state } = useStore()
  const task = state.tasks.find((t) => t.id === taskId)
  const gid = linkedGoalId(state, taskId, task?.projectId)
  const goal = gid ? state.goals.find((g) => g.id === gid) : undefined
  const project = task?.projectId ? state.projects.find((p) => p.id === task.projectId) : undefined
  if (!goal && !project) return null
  return (
    <p className="muted">
      {goal ? `Goal: ${goal.title}` : null}
      {goal && project ? ' · ' : null}
      {project ? `Project: ${project.name}` : null}
    </p>
  )
}
