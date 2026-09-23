import { useState } from 'react'
import { DateField } from './DateField'
import { Field, Modal } from './ui'
import { minutesToStamp } from '../lib/cal-layout'
import { addDays, minutesOf, parseISO, toISO, todayISO } from '../lib/dates'
import type { Task } from '../lib/types'
import { useStore } from '../store'

function tomorrow() {
  return toISO(addDays(parseISO(todayISO()), 1))
}

export function Continuance({
  task,
  onClose,
}: {
  task: Task
  onClose: () => void
}) {
  const { toggleTask, addTask, addEvent } = useStore()
  const [when, setWhen] = useState(false)
  const [date, setDate] = useState(task.due && task.due > todayISO() ? task.due : tomorrow())
  const [time, setTime] = useState(task.dueTime || '09:00')
  const [onCal, setOnCal] = useState(Boolean(task.eventId || task.dueTime || task.listId === 'calendar'))

  const complete = () => toggleTask(task.id)

  const schedule = () => {
    complete()
    const start = time || '09:00'
    const eventId = onCal
      ? addEvent(
          {
            title: task.title,
            date,
            start,
            end: minutesToStamp(minutesOf(start) + 30),
            allDay: false,
            notes: 'Continuance',
          },
          { daily: false },
        )
      : undefined
    addTask({
      title: task.title,
      notes: task.notes ? `${task.notes}\n\nContinuance of completed item.` : 'Continuance of completed item.',
      listId: task.listId,
      due: date,
      dueTime: start,
      priority: task.priority,
      projectId: task.projectId,
      goalId: task.goalId,
      milestoneId: task.milestoneId,
      workstreamId: task.workstreamId,
      eventId,
    })
    onClose()
  }

  return (
    <Modal title="Continuance?" onClose={onClose} persist>
      <p>
        <strong>{task.title}</strong>
      </p>
      {!when ? (
        <>
          <p className="muted">Does this need a continuance on the schedule? The current item will still be marked complete.</p>
          <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                complete()
                onClose()
              }}
            >
              No — just complete
            </button>
            <button type="button" className="btn" onClick={() => setWhen(true)}>
              Yes — schedule continuance
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="muted">Current task will be completed. Place the next occurrence:</p>
          <Field label="Date">
            <DateField value={date} onChange={setDate} />
          </Field>
          <Field label="Time">
            <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
          <label className="row">
            <input type="checkbox" checked={onCal} onChange={(e) => setOnCal(e.target.checked)} />
            Also put a time block on Calendar
          </label>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn-ghost" onClick={() => setWhen(false)}>
              Back
            </button>
            <button type="button" className="btn" onClick={schedule}>
              Complete and schedule
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
