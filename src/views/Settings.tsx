import { useState } from 'react'
import { useAuth } from '../auth/auth'
import { useGoogleCalendar } from '../google'
import { Field } from '../components/ui'
import { Icon } from '../icons'
import { readXaiKey, writeXaiKey } from '../lib/travis'
import { useStore } from '../store'

export function Settings() {
  const { state, updateSettings, importState, resetState } = useStore()
  const { username, signOut } = useAuth()
  const gcal = useGoogleCalendar()
  const s = state.settings
  const [msg, setMsg] = useState('')
  const [showGoogleHelp, setShowGoogleHelp] = useState(!s.googleClientId)
  const [xai, setXai] = useState(() => readXaiKey())

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
          <Field label="What should Sepho call you?">
            <input className="input" value={s.name} onChange={(e) => updateSettings({ name: e.target.value })} />
          </Field>
          <Field label="Theme">
            <select className="select" value={s.theme} onChange={(e) => updateSettings({ theme: e.target.value as typeof s.theme })}>
              <option value="system">Match system</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </Field>
          <Field label="Active project capacity">
            <input
              className="input"
              type="number"
              min={1}
              max={50}
              value={s.activeProjectLimit ?? 10}
              onChange={(e) => updateSettings({ activeProjectLimit: Math.max(1, Number(e.target.value) || 10) })}
            />
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
          <h2>First three after waking</h2>
          <p className="muted">These stay on Today. Check them off each morning; edit the names here.</p>
          {([0, 1, 2] as const).map((i) => (
            <Field key={i} label={`Ritual ${i + 1}`}>
              <input
                className="input"
                value={s.morningRituals?.[i] ?? ''}
                onChange={(e) => {
                  const next = [...(s.morningRituals ?? ['', '', ''])] as [string, string, string]
                  next[i] = e.target.value
                  updateSettings({ morningRituals: next })
                }}
              />
            </Field>
          ))}
        </section>

        <section className="card stack">
          <h2>Sepho</h2>
          <p className="muted">Your operating system. Press J or tap the orb, then type a command. Paste an xAI key so replies use Eve’s voice.</p>
          <label className="row">
            <input type="checkbox" checked={s.travisVoice !== false} onChange={(e) => updateSettings({ travisVoice: e.target.checked })} />
            Voice
          </label>
          <Field label="xAI API key (stays on this device)">
            <input
              className="input"
              type="password"
              value={xai}
              autoComplete="off"
              placeholder="xai-…"
              onChange={(e) => {
                setXai(e.target.value)
                writeXaiKey(e.target.value)
              }}
            />
          </Field>
          <p className="muted">
            Get a key and add credits at{' '}
            <a href="https://console.x.ai" target="_blank" rel="noreferrer">
              console.x.ai
            </a>
            . Sepho uses POST /v1/tts with voice Eve. A key with no team credits will fail.
          </p>
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
          <h2>Google & device sync</h2>
          {gcal.connected ? (
            <p className="muted">
              Linked as {gcal.email || 'Google'}. Tasks, projects, notes, journal, and calendar now follow this Google account across phone and computer.
              {gcal.cloudAt ? ` Last synced ${new Date(gcal.cloudAt).toLocaleTimeString()}.` : ''}
            </p>
          ) : (
            <p className="muted">Connect the same Google account on this device to pull in work you already entered on the other one.</p>
          )}
          <Field label="Google OAuth client ID">
            <input
              className="input"
              value={s.googleClientId}
              placeholder="xxxx.apps.googleusercontent.com"
              onChange={(e) => updateSettings({ googleClientId: e.target.value.trim() })}
              autoComplete="off"
            />
          </Field>
          <label className="row">
            <input
              type="checkbox"
              checked={s.pushToGoogle}
              onChange={(e) => updateSettings({ pushToGoogle: e.target.checked })}
            />
            Save new events to Google by default
          </label>
          <div className="row">
            {gcal.connected ? (
              <>
                <button className="btn" onClick={() => void gcal.refresh(undefined, true).then(() => gcal.syncCloud())} disabled={gcal.loading}>
                  <Icon name="google" size={16} /> {gcal.loading ? 'Syncing…' : 'Sync now'}
                </button>
                <button className="btn-ghost" onClick={gcal.disconnect}>
                  Disconnect
                </button>
              </>
            ) : (
              <button className="btn" onClick={() => void gcal.connect()} disabled={!s.googleClientId || gcal.loading}>
                <Icon name="google" size={16} /> Connect Google
              </button>
            )}
          </div>
          {gcal.error ? <p className="gate-error">{gcal.error}</p> : null}
          {gcal.cloudMsg ? <p className="muted">{gcal.cloudMsg}</p> : null}
          <button className="btn-ghost" onClick={() => setShowGoogleHelp((v) => !v)}>
            {showGoogleHelp ? 'Hide setup steps' : 'How to get a client ID'}
          </button>
          {showGoogleHelp ? (
            <ol className="muted" style={{ paddingLeft: 18, margin: 0, display: 'grid', gap: 6 }}>
              <li>
                Open{' '}
                <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">
                  Google Cloud Credentials
                </a>
              </li>
              <li>
                Enable the{' '}
                <a
                  href="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com?project=969056584851"
                  target="_blank"
                  rel="noreferrer"
                >
                  Google Calendar API
                </a>{' '}
                for this project, then wait a minute.
              </li>
              <li>
                Open{' '}
                <a href="https://console.cloud.google.com/auth/audience" target="_blank" rel="noreferrer">
                  OAuth consent / Audience
                </a>
                . Keep publishing status on <strong>Testing</strong> (no Google verification needed for you).
              </li>
              <li>
                Under <strong>Test users</strong>, add <code>kensbrivaus103@gmail.com</code> — the exact account you
                sign in with. Leave Testing; do not click Publish.
              </li>
              <li>
                Create credentials → OAuth client ID → <strong>Web application</strong>.
              </li>
              <li>
                Authorized JavaScript origins: <code>https://kenswidzerbrivaus.com</code>,{' '}
                <code>http://localhost:5173</code>, <code>http://127.0.0.1:5173</code>
              </li>
              <li>Paste the client ID above, then Connect again with that Gmail.</li>
            </ol>
          ) : null}
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
                if (confirm('Reset Sepho to sample data? This cannot be undone unless you exported a backup.')) {
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
