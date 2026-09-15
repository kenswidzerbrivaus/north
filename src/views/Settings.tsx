import { useState } from 'react'
import { useAuth } from '../auth/auth'
import { Field } from '../components/ui'
import { useStore } from '../store'

export function Settings() {
  const { state, updateSettings, importState, resetState } = useStore()
  const { username, signOut } = useAuth()
  const s = state.settings
  const [msg, setMsg] = useState('')

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `north-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMsg('Backup downloaded.')
  }

  return (
    <div>
      <header className="page-head">
        <div>
          <p className="kicker">Make it yours</p>
          <h1>Settings</h1>
        </div>
      </header>

      <div className="grid-2">
        <section className="card stack">
          <h2>Profile</h2>
          <p className="muted">Signed in as {username}</p>
          <Field label="What should North call you?">
            <input className="input" value={s.name} onChange={(e) => updateSettings({ name: e.target.value })} />
          </Field>
          <Field label="Theme">
            <select className="select" value={s.theme} onChange={(e) => updateSettings({ theme: e.target.value as typeof s.theme })}>
              <option value="system">Match system</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </Field>
          <Field label="Week starts on">
            <select
              className="select"
              value={s.weekStartsOn}
              onChange={(e) => updateSettings({ weekStartsOn: Number(e.target.value) as 0 | 1 })}
            >
              <option value={1}>Monday</option>
              <option value={0}>Sunday</option>
            </select>
          </Field>
        </section>

        <section className="card stack">
          <h2>Focus timer</h2>
          <Field label="Focus minutes">
            <input
              className="input"
              type="number"
              min={1}
              max={180}
              value={s.focusMinutes}
              onChange={(e) => updateSettings({ focusMinutes: Math.max(1, Number(e.target.value) || 25) })}
            />
          </Field>
          <Field label="Short break">
            <input
              className="input"
              type="number"
              min={1}
              max={60}
              value={s.shortBreak}
              onChange={(e) => updateSettings({ shortBreak: Math.max(1, Number(e.target.value) || 5) })}
            />
          </Field>
          <Field label="Long break">
            <input
              className="input"
              type="number"
              min={1}
              max={90}
              value={s.longBreak}
              onChange={(e) => updateSettings({ longBreak: Math.max(1, Number(e.target.value) || 15) })}
            />
          </Field>
          <Field label="Rounds until long break">
            <input
              className="input"
              type="number"
              min={1}
              max={12}
              value={s.roundsUntilLong}
              onChange={(e) => updateSettings({ roundsUntilLong: Math.max(1, Number(e.target.value) || 4) })}
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

        <section className="card stack">
          <h2>Data</h2>
          <p className="muted">Everything lives in this browser. Export a backup if you switch machines.</p>
          <div className="row">
            <button className="btn" onClick={exportBackup}>
              Export backup
            </button>
            <label className="btn-ghost">
              Import
              <input
                type="file"
                accept="application/json"
                hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  try {
                    importState(JSON.parse(await file.text()))
                    setMsg('Backup restored.')
                  } catch (err) {
                    setMsg(err instanceof Error ? err.message : 'Could not import.')
                  }
                }}
              />
            </label>
            <button
              className="btn-danger"
              onClick={() => {
                if (confirm('Reset North to sample data? This cannot be undone unless you exported a backup.')) {
                  resetState()
                  setMsg('Workspace reset.')
                }
              }}
            >
              Reset
            </button>
          </div>
          {msg ? <p className="muted">{msg}</p> : null}
        </section>

        <section className="card stack">
          <h2>Access</h2>
          <p className="muted">Only your sign-in can open this workspace in the browser.</p>
          <button className="btn-ghost" onClick={signOut}>
            Sign out
          </button>
        </section>

        <section className="card">
          <h2>Shortcuts</h2>
          <p className="muted">⌘K command palette</p>
          <p className="muted">1–9 jump between sections</p>
          <p className="muted">N new item on the current page</p>
          <p className="muted">Space start or pause the timer (when not typing)</p>
        </section>
      </div>
    </div>
  )
}
