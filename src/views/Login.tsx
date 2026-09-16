import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/auth'
import { Field } from '../components/ui'
import { MatrixRain } from './MatrixRain'

export function Login() {
  const { signIn, lockUntil } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    document.documentElement.classList.add('matrix-gate')
    const meta = document.querySelector('meta[name="theme-color"]')
    const prev = meta?.getAttribute('content')
    meta?.setAttribute('content', '#010301')
    return () => {
      document.documentElement.classList.remove('matrix-gate')
      if (meta && prev) meta.setAttribute('content', prev)
    }
  }, [])

  useEffect(() => {
    if (lockUntil <= Date.now()) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [lockUntil])

  const lockedMs = Math.max(0, lockUntil - now)
  const locked = lockedMs > 0

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy || locked) return
    setBusy(true)
    setError('')
    const result = await signIn(username, password, remember)
    if (result === 'invalid') setError('That sign-in doesn’t match.')
    if (result === 'locked') setError('Too many attempts. Wait a moment.')
    setBusy(false)
  }

  return (
    <div className="gate">
      <MatrixRain />
      <div className="gate-veil" />
      <form className="gate-card" onSubmit={submit}>
        <div className="brand" style={{ padding: 0, marginBottom: 8 }}>
          <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden>
            <path d="M16 3 L18.4 13.6 L29 16 L18.4 18.4 L16 29 L13.6 18.4 L3 16 L13.6 13.6 Z" fill="#39ff14" />
          </svg>
          <div>
            <h1>North</h1>
            <small>Private workspace</small>
          </div>
        </div>
        <p className="muted">Sign in to continue. This space is only for you.</p>
        <Field label="Username">
          <input
            className="input"
            autoComplete="username"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Password">
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <label className="row">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Keep me signed in on this device
        </label>
        {error ? <p className="gate-error">{error}</p> : null}
        {locked ? <p className="muted">Try again in {Math.ceil(lockedMs / 1000)}s</p> : null}
        <button className="btn" type="submit" disabled={busy || locked || !username || !password}>
          {busy ? 'Checking…' : 'Enter'}
        </button>
      </form>
    </div>
  )
}
