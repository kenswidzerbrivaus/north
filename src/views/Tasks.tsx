import { useEffect, useMemo, useState } from 'react'
import { Continuance } from '../components/Continuance'
import { Check, Empty, Field, Modal } from '../components/ui'
import { Icon } from '../icons'
import { formatShort, formatTime, todayISO } from '../lib/dates'
import { PALETTE } from '../lib/types'
import { useStore } from '../store'

type Filter = 'today' | 'inbox' | 'upcoming' | 'all' | 'done'

const PRI = ['None', 'Low', 'Med', 'High'] as const

export function Tasks() {
  const { state, addTask, toggleTask, updateTask, deleteTask, addList, deleteList, addSubtask, toggleSubtask } =
    useStore()
  const today = todayISO()
  const [filter, setFilter] = useState<Filter>('today')
  const [listId, setListId] = useState<string | 'all'>('all')
  const [draft, setDraft] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [newList, setNewList] = useState(false)
  const [listName, setListName] = useState('')
  const [projectId, setProjectId] = useState(() => new URLSearchParams(location.hash.split('?')[1] ?? '').get('project'))
  const [cont, setCont] = useState<string | null>(null)

  useEffect(() => {
    const on = () => setProjectId(new URLSearchParams(location.hash.split('?')[1] ?? '').get('project'))
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  const tasks = useMemo(() => {
    return state.tasks.filter((t) => {
      if (projectId && t.projectId !== projectId) return false
      if (listId !== 'all' && t.listId !== listId) return false
      if (filter === 'done') return t.completed
      if (t.completed) return false
      if (filter === 'inbox') return t.listId === 'inbox' && !t.due
      if (filter === 'today') {
        if (!t.due) return false
        if (t.googleId || t.listId === 'calendar') return t.due === today
        return t.due <= today
      }
      if (filter === 'upcoming') return Boolean(t.due && t.due > today)
      return true
    })
  }, [filter, listId, projectId, state.tasks, today])

  const open = state.tasks.find((t) => t.id === selected)
  const listOf = (id: string) => state.lists.find((l) => l.id === id)

  const submit = () => {
    const title = draft.trim()
    if (!title) return
    const id = addTask({
      title,
      listId: listId === 'all' ? 'inbox' : listId,
      due: filter === 'today' ? today : undefined,
      projectId: projectId || undefined,
    })
    setDraft('')
    setSelected(id)
  }

  return (
    <div>
      <header className="page-head">
        <div>
          <p className="kicker">Capture and close</p>
          <h1>Tasks{projectId ? ' // project' : ''}</h1>
          {projectId ? (
            <button className="btn-ghost" onClick={() => { location.hash = '#/tasks' }}>
              Clear project filter
            </button>
          ) : null}
        </div>
      </header>

      <div className="split">
        <aside className="list-col">
          {(['today', 'inbox', 'upcoming', 'all', 'done'] as Filter[]).map((f) => (
            <button key={f} className="list-btn" data-on={filter === f && listId === 'all'} onClick={() => { setFilter(f); setListId('all') }}>
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
          <p className="kicker" style={{ margin: '12px 8px 4px' }}>Lists</p>
          {state.lists.map((l) => (
            <button
              key={l.id}
              className="list-btn"
              data-on={listId === l.id}
              onClick={() => {
                setListId(l.id)
                setFilter('all')
              }}
            >
              <span className="dot" style={{ background: l.color }} />
              {l.name}
            </button>
          ))}
          <button className="btn-ghost" onClick={() => setNewList(true)}>
            <Icon name="plus" size={14} /> New list
          </button>
        </aside>

        <div>
          <form
            className="row"
            style={{ marginBottom: 12 }}
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <input
              className="input"
              placeholder="Add a task and press Enter"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button className="btn" type="submit">
              Add
            </button>
          </form>

          {tasks.length === 0 ? (
            <Empty title="No tasks here" body="Add one above, or switch lists from the left." />
          ) : (
            tasks.map((t) => (
              <div
                key={t.id}
                className={`task-row${t.completed ? ' done' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => setSelected(t.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelected(t.id)
                  }
                }}
              >
                <span onClick={(e) => e.stopPropagation()}>
                  <Check
                    on={t.completed}
                    onClick={() => {
                      if (t.completed) toggleTask(t.id)
                      else setCont(t.id)
                    }}
                  />
                </span>
                <div>
                  <div className="task-title">{t.title}</div>
                  <div className="meta">
                    <span className="dot" style={{ background: listOf(t.listId)?.color }} />
                    {listOf(t.listId)?.name}
                    {t.due ? <span>{t.due < today && !t.completed ? 'Overdue · ' : ''}{formatShort(t.due)}{t.dueTime ? ` ${formatTime(t.dueTime)}` : ''}</span> : null}
                    {t.eventId || t.googleId ? <span>On calendar</span> : null}
                    {t.projectId ? <span>{state.projects.find((p) => p.id === t.projectId)?.name}</span> : null}
                    {t.priority ? (
                      <span className="prio" data-p={t.priority}>
                        {PRI[t.priority]}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}

          {open ? (
            <div className="inspector" style={{ marginTop: 18 }}>
              <Field label="Title">
                <input className="input" value={open.title} onChange={(e) => updateTask(open.id, { title: e.target.value })} />
              </Field>
              <div className="grid-2" style={{ marginTop: 10 }}>
                <Field label="List">
                  <select className="select" value={open.listId} onChange={(e) => updateTask(open.id, { listId: e.target.value })}>
                    {state.lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Priority">
                  <select
                    className="select"
                    value={open.priority}
                    onChange={(e) => updateTask(open.id, { priority: Number(e.target.value) as 0 | 1 | 2 | 3 })}
                  >
                    {PRI.map((p, i) => (
                      <option key={p} value={i}>
                        {p}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Due date">
                  <input className="input" type="date" value={open.due ?? ''} onChange={(e) => updateTask(open.id, { due: e.target.value || undefined })} />
                </Field>
                <Field label="Time">
                  <input className="input" type="time" value={open.dueTime ?? ''} onChange={(e) => updateTask(open.id, { dueTime: e.target.value || undefined })} />
                </Field>
              </div>
              <Field label="Notes">
                <textarea className="textarea" value={open.notes} onChange={(e) => updateTask(open.id, { notes: e.target.value })} />
              </Field>
              <Field label="Project">
                <select
                  className="select"
                  value={open.projectId ?? ''}
                  onChange={(e) => updateTask(open.id, { projectId: e.target.value || undefined })}
                >
                  <option value="">None</option>
                  {state.projects.filter((p) => p.state !== 'archived').map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Goal">
                <select
                  className="select"
                  value={open.goalId ?? ''}
                  onChange={(e) => updateTask(open.id, { goalId: e.target.value || undefined })}
                >
                  <option value="">None (prefer project link)</option>
                  {state.goals.filter((g) => g.status === 'active' || g.status === 'paused').map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
                </select>
              </Field>
              <p className="kicker" style={{ margin: '12px 0 6px' }}>
                Subtasks
              </p>
              {open.subtasks.map((st) => (
                <div key={st.id} className="task-row">
                  <Check on={st.completed} onClick={() => toggleSubtask(open.id, st.id)} />
                  <span className={st.completed ? 'done task-title' : 'task-title'}>{st.title}</span>
                </div>
              ))}
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const fd = new FormData(e.currentTarget)
                  const title = String(fd.get('sub') ?? '').trim()
                  if (title) addSubtask(open.id, title)
                  e.currentTarget.reset()
                }}
              >
                <input className="input" name="sub" placeholder="Add subtask" />
              </form>
              <div className="row" style={{ marginTop: 16 }}>
                <button className="btn-danger" onClick={() => { deleteTask(open.id); setSelected(null) }}>
                  <Icon name="trash" size={14} /> Delete task
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {cont && state.tasks.find((t) => t.id === cont) ? (
        <Continuance task={state.tasks.find((t) => t.id === cont)!} onClose={() => setCont(null)} />
      ) : null}

      {newList ? (
        <Modal title="New list" onClose={() => setNewList(false)}>
          <Field label="Name">
            <input className="input" value={listName} onChange={(e) => setListName(e.target.value)} autoFocus />
          </Field>
          <div className="row" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
            <button
              className="btn"
              onClick={() => {
                if (listName.trim()) addList(listName.trim(), PALETTE[state.lists.length % PALETTE.length])
                setListName('')
                setNewList(false)
              }}
            >
              Create
            </button>
          </div>
        </Modal>
      ) : null}

      {listId !== 'all' && listId !== 'inbox' && listId !== 'calendar' ? (
        <p className="muted" style={{ marginTop: 18 }}>
          <button className="btn-ghost" onClick={() => { deleteList(listId); setListId('all') }}>
            Delete this list
          </button>
        </p>
      ) : null}
    </div>
  )
}
