import { useEffect, useMemo, useState } from 'react'
import { AuthProvider, useAuth } from './auth/auth'
import { GoogleCalendarProvider } from './google'
import { Icon, type IconName } from './icons'
import { isTypingTarget, useRoute } from './lib/route'
import { ROUTES, type Route } from './lib/types'
import { StoreProvider, useStore } from './store'
import { TimerProvider, useTimer } from './timer'
import { Login } from './views/Login'
import { Calendar } from './views/Calendar'
import { Focus } from './views/Focus'
import { Goals } from './views/Goals'
import { Habits } from './views/Habits'
import { Journal } from './views/Journal'
import { Notes } from './views/Notes'
import { Settings } from './views/Settings'
import { Tasks } from './views/Tasks'
import { Today } from './views/Today'

const NAV_ICON: Record<Route, IconName> = {
  today: 'today',
  tasks: 'tasks',
  calendar: 'calendar',
  habits: 'habits',
  focus: 'focus',
  notes: 'notes',
  goals: 'goals',
  journal: 'journal',
  settings: 'settings',
}

function resolvedTheme(mode: 'light' | 'dark' | 'system') {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return mode
}

export default function App() {
  return (
    <StoreProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </StoreProvider>
  )
}

function Gate() {
  const auth = useAuth()
  const { state } = useStore()
  const theme = resolvedTheme(state.settings.theme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#12100e' : '#efe8db')
  }, [theme])

  if (!auth.ready) return null
  if (!auth.authed) return <Login />
  return (
    <GoogleCalendarProvider>
      <TimerProvider>
        <Shell />
      </TimerProvider>
    </GoogleCalendarProvider>
  )
}

function Shell() {
  const { state, addTask, addNote, addEvent } = useStore()
  const { signOut } = useAuth()
  const { running, start, pause } = useTimer()
  const [route, go] = useRoute()
  const [cmd, setCmd] = useState(false)
  const [more, setMore] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCmd((v) => !v)
        setQuery('')
        setActive(0)
        return
      }
      if (cmd) {
        if (e.key === 'Escape') setCmd(false)
        return
      }
      if (isTypingTarget(e.target)) return
      if (e.key === ' ') {
        e.preventDefault()
        running ? pause() : start()
      }
      if (e.key >= '1' && e.key <= '9') {
        const r = ROUTES[Number(e.key) - 1]
        if (r) go(r.id)
      }
      if (e.key.toLowerCase() === 'n') {
        if (route === 'tasks' || route === 'today') {
          const title = prompt('New task')
          if (title?.trim()) addTask({ title: title.trim() })
        } else if (route === 'notes') addNote()
        else if (route === 'calendar') {
          const title = prompt('New event')
          if (title?.trim()) addEvent({ title: title.trim(), date: new Date().toISOString().slice(0, 10), allDay: true })
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [addEvent, addNote, addTask, cmd, go, pause, route, running, start])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const items: { id: string; title: string; hint: string; run: () => void }[] = [
      ...ROUTES.map((r) => ({
        id: `go-${r.id}`,
        title: `Go to ${r.label}`,
        hint: r.hint,
        run: () => go(r.id),
      })),
      {
        id: 'new-task',
        title: q ? `Add task “${query.trim()}”` : 'Add a task',
        hint: 'N',
        run: () => {
          if (query.trim()) addTask({ title: query.trim() })
          else go('tasks')
        },
      },
    ]
    if (!q) return items
    for (const t of state.tasks) {
      if (t.title.toLowerCase().includes(q)) {
        items.push({ id: t.id, title: t.title, hint: 'Task', run: () => go('tasks') })
      }
    }
    for (const n of state.notes) {
      if (`${n.title} ${n.body}`.toLowerCase().includes(q)) {
        items.push({ id: n.id, title: n.title || 'Untitled', hint: 'Note', run: () => go('notes') })
      }
    }
    for (const e of state.events) {
      if (e.title.toLowerCase().includes(q)) {
        items.push({ id: e.id, title: e.title, hint: 'Event', run: () => go('calendar') })
      }
    }
    return items.filter((i) => i.title.toLowerCase().includes(q) || i.hint.toLowerCase().includes(q)).slice(0, 18)
  }, [addTask, go, query, state.events, state.notes, state.tasks])

  useEffect(() => {
    setActive(0)
  }, [query])

  const view = {
    today: <Today go={go} />,
    tasks: <Tasks />,
    calendar: <Calendar />,
    habits: <Habits />,
    focus: <Focus />,
    notes: <Notes />,
    goals: <Goals />,
    journal: <Journal />,
    settings: <Settings />,
  }[route]

  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="#/today">
          <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden>
            <path d="M16 3 L18.4 13.6 L29 16 L18.4 18.4 L16 29 L13.6 18.4 L3 16 L13.6 13.6 Z" fill="var(--accent)" />
          </svg>
          <div>
            <h1>North</h1>
            <small>Your day, oriented</small>
          </div>
        </a>
        <nav className="nav" aria-label="Primary">
          {ROUTES.map((r) => (
            <button key={r.id} className="nav-btn" data-on={route === r.id} onClick={() => go(r.id)}>
              <Icon name={NAV_ICON[r.id]} />
              {r.label}
              <span>{r.hint}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <button className="search-btn" onClick={() => setCmd(true)}>
            <Icon name="search" size={16} />
            Search
            <span style={{ marginLeft: 'auto', fontSize: 11 }}>⌘K</span>
          </button>
          <button className="btn-ghost" onClick={signOut}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="top-mobile">
          <strong className="display" style={{ fontSize: 22, fontStyle: 'italic' }}>
            North
          </strong>
          <div className="row">
            <button className="btn-icon" onClick={() => setCmd(true)} aria-label="Search">
              <Icon name="search" />
            </button>
            <button className="btn-icon" onClick={() => setMore(true)} aria-label="More">
              <Icon name="more" />
            </button>
          </div>
        </div>
        {view}
      </main>

      <nav className="bottom-nav" aria-label="Mobile">
        {(['today', 'tasks', 'calendar', 'habits', 'focus'] as Route[]).map((id) => (
          <button key={id} data-on={route === id} onClick={() => go(id)}>
            <Icon name={NAV_ICON[id]} size={16} />
            {ROUTES.find((r) => r.id === id)?.label}
          </button>
        ))}
      </nav>

      {more ? (
        <div className="modal-backdrop" onMouseDown={() => setMore(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <header className="modal-head">
              <h2>More</h2>
              <button className="btn-icon" onClick={() => setMore(false)} aria-label="Close">
                <Icon name="close" />
              </button>
            </header>
            <div className="stack">
              {(['notes', 'goals', 'journal', 'settings'] as Route[]).map((id) => (
                <button
                  key={id}
                  className="list-btn"
                  data-on={route === id}
                  onClick={() => {
                    go(id)
                    setMore(false)
                  }}
                >
                  <Icon name={NAV_ICON[id]} />
                  {ROUTES.find((r) => r.id === id)?.label}
                </button>
              ))}
              <button className="list-btn" onClick={signOut}>
                Sign out
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {cmd ? (
        <div className="modal-backdrop" onMouseDown={() => setCmd(false)}>
          <div
            className="cmdk"
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((i) => Math.min(results.length - 1, i + 1))
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((i) => Math.max(0, i - 1))
              }
              if (e.key === 'Enter') {
                results[active]?.run()
                setCmd(false)
              }
            }}
          >
            <input
              className="input"
              style={{ border: 0, borderRadius: 0, boxShadow: 'none' }}
              autoFocus
              placeholder="Jump, search, or add a task…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="cmdk-list">
              {results.map((r, i) => (
                <button
                  key={r.id}
                  className="cmdk-item"
                  data-on={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => {
                    r.run()
                    setCmd(false)
                  }}
                >
                  <span>{r.title}</span>
                  <span className="muted">{r.hint}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
