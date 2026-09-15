import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { OWNER_USERNAME, PASSWORD_HASH_HEX, PASSWORD_SALT_HEX, PBKDF2_ITERATIONS } from './credentials'

const SESSION_KEY = 'north.auth.session'
const FAIL_KEY = 'north.auth.fails'
const MAX_FAILS = 5
const LOCK_MS = 45_000
const SESSION_MS = 1000 * 60 * 60 * 24 * 30

type Session = { exp: number }

type AuthApi = {
  ready: boolean
  authed: boolean
  username: string
  lockUntil: number
  signIn: (username: string, password: string, remember: boolean) => Promise<'ok' | 'invalid' | 'locked'>
  signOut: () => void
}

const AuthCtx = createContext<AuthApi | null>(null)

function hexToBytes(hex: string) {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

function bytesToHex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function timingEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function hashPassword(password: string) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: hexToBytes(PASSWORD_SALT_HEX),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    key,
    256,
  )
  return bytesToHex(bits)
}

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Session
    if (!parsed?.exp || parsed.exp < Date.now()) {
      localStorage.removeItem(SESSION_KEY)
      sessionStorage.removeItem(SESSION_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function readFails(): { n: number; lockUntil: number } {
  try {
    return JSON.parse(sessionStorage.getItem(FAIL_KEY) ?? '{"n":0,"lockUntil":0}')
  } catch {
    return { n: 0, lockUntil: 0 }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [authed, setAuthed] = useState(false)
  const [lockUntil, setLockUntil] = useState(0)

  useEffect(() => {
    const s = readSession()
    setAuthed(Boolean(s))
    setLockUntil(readFails().lockUntil)
    setReady(true)
  }, [])

  const signIn = useCallback(async (username: string, password: string, remember: boolean) => {
    const fails = readFails()
    if (fails.lockUntil > Date.now()) {
      setLockUntil(fails.lockUntil)
      return 'locked'
    }
    const userOk = timingEqual(username.trim(), OWNER_USERNAME)
    const hash = await hashPassword(password)
    const passOk = timingEqual(hash, PASSWORD_HASH_HEX)
    if (!userOk || !passOk) {
      const n = fails.n + 1
      const next = { n, lockUntil: n >= MAX_FAILS ? Date.now() + LOCK_MS : 0 }
      sessionStorage.setItem(FAIL_KEY, JSON.stringify(next))
      setLockUntil(next.lockUntil)
      return next.lockUntil ? 'locked' : 'invalid'
    }
    sessionStorage.removeItem(FAIL_KEY)
    const session: Session = { exp: Date.now() + SESSION_MS }
    const raw = JSON.stringify(session)
    sessionStorage.setItem(SESSION_KEY, raw)
    if (remember) localStorage.setItem(SESSION_KEY, raw)
    else localStorage.removeItem(SESSION_KEY)
    setAuthed(true)
    setLockUntil(0)
    return 'ok'
  }, [])

  const signOut = useCallback(() => {
    localStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(SESSION_KEY)
    setAuthed(false)
  }, [])

  const value = useMemo(
    () => ({ ready, authed, username: OWNER_USERNAME, lockUntil, signIn, signOut }),
    [authed, lockUntil, ready, signIn, signOut],
  )
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
