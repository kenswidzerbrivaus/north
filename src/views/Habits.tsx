import { useState } from 'react'
import { Check, ColorDots, Empty, Field, Modal } from '../components/ui'
import { Icon } from '../icons'
import { addDays, parseISO, startOfWeek, toISO, todayISO } from '../lib/dates'
import { habitDone, habitStreak, isHabitDue, logCount, weekRate } from '../lib/habits'
import { PALETTE, type Habit } from '../lib/types'
import { useStore } from '../store'

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function Habits() {
  const { state, addHabit, updateHabit, deleteHabit, setHabitCount } = useStore()
  const today = todayISO()
  const [edit, setEdit] = useState<Partial<Habit> & { name?: string } | null>(null)
  const habits = state.habits.filter((h) => !h.archived)

  const save = () => {
    if (!edit?.name?.trim()) return
    if (edit.id) updateHabit(edit.id, { name: edit.name, color: edit.color, days: edit.days ?? [], target: edit.target ?? 1 })
    else
      addHabit({
        name: edit.name,
        color: edit.color ?? PALETTE[0],
        days: edit.days ?? [],
        target: edit.target ?? 1,
      })
    setEdit(null)
  }

  return (
    <div>
      <header className="page-head page-head-route">
        <div>
          <p className="kicker">Show up, quietly</p>
          <h1>Habits</h1>
        </div>
        <button
          className="btn"
          onClick={() => setEdit({ name: '', color: PALETTE[habits.length % PALETTE.length], days: [], target: 1 })}
        >
          <Icon name="plus" size={16} /> New habit
        </button>
      </header>

      {habits.length === 0 ? (
        <Empty title="No habits yet" body="Pick one small thing you want to repeat. Streaks take care of themselves." />
      ) : (
        <div className="grid-2">
          {habits.map((h) => {
            const streak = habitStreak(h, state.habitLogs, today)
            const week = weekRate(h, state.habitLogs, today)
            const on = habitDone(h, state.habitLogs, today)
            const due = isHabitDue(h, new Date())
            return (
              <article key={h.id} className="card habit-card">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <h3>{h.name}</h3>
                  <button className="btn-icon" onClick={() => setEdit({ ...h })} aria-label="Edit habit">
                    <Icon name="edit" size={16} />
                  </button>
                </div>
                <p className="muted">
                  {streak} day streak · {week.done}/{week.due || 0} this week
                </p>
                <div className="row" style={{ margin: '12px 0' }}>
                  {Array.from({ length: 7 }, (_, i) => {
                    const d = addDays(parseISO(today), i - 6)
                    const iso = toISO(d)
                    const scheduled = isHabitDue(h, d)
                    const done = habitDone(h, state.habitLogs, iso)
                    return (
                      <button
                        key={iso}
                        className="chip"
                        data-on={done}
                        disabled={!scheduled}
                        onClick={() => setHabitCount(h.id, iso, done ? 0 : h.target)}
                        title={iso}
                      >
                        {DAY_LABELS[d.getDay()]}
                      </button>
                    )
                  })}
                </div>
                {due ? (
                  <div className="row">
                    <Check on={on} onClick={() => setHabitCount(h.id, today, on ? 0 : h.target)} label={`Complete ${h.name}`} />
                    <span>{on ? 'Done today' : `Mark ${h.target > 1 ? `${logCount(state.habitLogs, h.id, today)}/${h.target}` : 'today'}`}</span>
                  </div>
                ) : (
                  <p className="muted">Off today</p>
                )}
                <Heat habit={h} logs={state.habitLogs} />
              </article>
            )
          })}
        </div>
      )}

      {edit ? (
        <Modal title={edit.id ? 'Edit habit' : 'New habit'} onClose={() => setEdit(null)}>
          <div className="stack">
            <Field label="Name">
              <input className="input" value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} autoFocus />
            </Field>
            <Field label="Times per day">
              <input
                className="input"
                type="number"
                min={1}
                max={12}
                value={edit.target ?? 1}
                onChange={(e) => setEdit({ ...edit, target: Math.max(1, Number(e.target.value) || 1) })}
              />
            </Field>
            <p className="kicker">Days · empty means every day</p>
            <div className="row">
              {DAY_LABELS.map((label, i) => {
                const on = (edit.days ?? []).includes(i)
                return (
                  <button
                    key={label + i}
                    className="chip"
                    data-on={on}
                    onClick={() => {
                      const days = new Set(edit.days ?? [])
                      if (days.has(i)) days.delete(i)
                      else days.add(i)
                      setEdit({ ...edit, days: [...days].sort() })
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            <ColorDots colors={PALETTE} value={edit.color ?? PALETTE[0]} onChange={(color) => setEdit({ ...edit, color })} />
            <div className="row" style={{ justifyContent: 'space-between' }}>
              {edit.id ? (
                <button className="btn-danger" onClick={() => { deleteHabit(edit.id!); setEdit(null) }}>
                  Delete
                </button>
              ) : (
                <span />
              )}
              <button className="btn" onClick={save}>
                Save
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}

function Heat({ habit, logs }: { habit: Habit; logs: { habitId: string; date: string; count: number }[] }) {
  const today = parseISO(todayISO())
  const start = startOfWeek(addDays(today, -84), 0)
  const len = Math.ceil((today.getTime() - start.getTime()) / 86400000) + 1
  const cells = Array.from({ length: len }, (_, i) => {
    const d = addDays(start, i)
    const iso = toISO(d)
    const count = logs.find((l) => l.habitId === habit.id && l.date === iso)?.count ?? 0
    const due = isHabitDue(habit, d) && iso >= habit.createdAt.slice(0, 10) && iso <= todayISO()
    const level = !due ? 0 : Math.min(1, count / habit.target)
    return { iso, level }
  })
  return (
    <div className="heat" aria-hidden>
      {cells.map((c) => (
        <i
          key={c.iso}
          title={c.iso}
          style={{
            background:
              c.level <= 0
                ? 'var(--line)'
                : `color-mix(in srgb, ${habit.color} ${20 + c.level * 80}%, var(--paper))`,
          }}
        />
      ))}
    </div>
  )
}
