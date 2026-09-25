import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  adoptPendingToken,
  beginGoogleRedirect,
  clearToken,
  createGoogleEvent,
  deleteGoogleEvent,
  ensureGoogleToken,
  isGoogleLinked,
  linkedClientId,
  listGoogleEvents,
  prefersRedirectAuth,
  readLink,
  readToken,
  tokenHasDriveScope,
  updateGoogleEvent,
} from './lib/google-calendar'
import { clearCloudFileId, pullCloudState, pushCloudState } from './lib/cloud-sync'
import { mergeStates, workFingerprint } from './lib/cloud-merge'
import { addDays } from './lib/dates'
import type { CalEvent } from './lib/types'
import { flushPersist, onPersist, peekState, useStore } from './store'

type GCal = {
  connected: boolean
  email: string
  events: CalEvent[]
  loading: boolean
  error: string
  connect: () => Promise<void>
  disconnect: () => void
  refresh: (around?: Date, force?: boolean) => Promise<void>
  syncCloud: () => Promise<void>
  cloudAt: number
  cloudMsg: string
  cloudNeedsTap: boolean
  driveBlocked: 'api' | 'scope' | null
  saveToGoogle: (event: Omit<CalEvent, 'id' | 'color'> & { id?: string; color?: string; googleId?: string }) => Promise<CalEvent | null>
  removeFromGoogle: (googleId: string) => Promise<void>
}

const Ctx = createContext<GCal | null>(null)

export function GoogleCalendarProvider({ children }: { children: ReactNode }) {
  const { state, syncFromCalendar, hydrateFromCloud, setGoogleClientId } = useStore()
  const clientId = state.settings.googleClientId.trim() || linkedClientId()
  const [email, setEmail] = useState(() => readLink()?.email || '')
  const [events, setEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [connected, setConnected] = useState(() => isGoogleLinked())
  const rangeKey = useRef('')
  const aroundRef = useRef<Date>(new Date())
  const loadingRef = useRef(false)
  const [cloudAt, setCloudAt] = useState(0)
  const [cloudMsg, setCloudMsg] = useState('')
  const [cloudNeedsTap, setCloudNeedsTap] = useState(false)
  const [driveBlocked, setDriveBlocked] = useState<'api' | 'scope' | null>(null)
  const pushing = useRef(false)
  const cloudReady = useRef(false)
  const lastCloudSavedAt = useRef(0)
  const queuedPush = useRef<ReturnType<typeof peekState>>(null)
  const pushTimer = useRef(0)

  const markLinked = useCallback(() => {
    const linked = readLink()
    setConnected(Boolean(linked || readToken()))
    setEmail(linked?.email || readToken()?.email || '')
  }, [])

  const refresh = useCallback(
    async (around?: Date, force = false) => {
      const center = around ?? aroundRef.current
      aroundRef.current = center
      const key = `${center.getFullYear()}-${center.getMonth()}`
      const linked = isGoogleLinked()
      if (!clientId) {
        if (!linked) {
          setConnected(false)
          setEvents([])
        }
        return
      }
      if (!linked && !readToken()) {
        setConnected(false)
        setEvents([])
        return
      }
      markLinked()
      if (!force && rangeKey.current === key && readToken()) return
      rangeKey.current = key
      loadingRef.current = true
      setLoading(true)
      setError('')
      const load = () => {
        const from = addDays(center, -40)
        const to = addDays(center, 70)
        return listGoogleEvents(from, to)
      }
      try {
        await ensureGoogleToken(clientId)
        const items = await load()
        setEvents(items)
        syncFromCalendar(items)
        markLinked()
        setError('')
      } catch (err) {
        rangeKey.current = ''
        const code = err instanceof Error ? err.message : ''
        if ((code === 'GOOGLE_AUTH' || code === 'GOOGLE_SCOPES') && clientId) {
          try {
            await ensureGoogleToken(clientId, code === 'GOOGLE_SCOPES')
            rangeKey.current = key
            const items = await load()
            setEvents(items)
            syncFromCalendar(items)
            markLinked()
            setError('')
            return
          } catch (inner) {
            rangeKey.current = ''
            const innerCode = inner instanceof Error ? inner.message : code
            if (innerCode === 'GOOGLE_NEEDS_GESTURE') {
              markLinked()
              setError('Calendar is still linked. Click Sync Google to resume (Google requires a click after the token expires).')
              return
            }
          }
        }
        if (code === 'GOOGLE_NEEDS_GESTURE') {
          markLinked()
          setError('Calendar is still linked. Click Sync Google to resume.')
          return
        }
        if (code === 'GOOGLE_SCOPES') {
          markLinked()
          setError('Google signed you in without Calendar access. Click Connect again and allow calendar permission.')
          return
        }
        setError(code && code !== 'GOOGLE_AUTH' ? code : 'Google Calendar needs to reconnect')
        if (!isGoogleLinked()) setConnected(false)
      } finally {
        loadingRef.current = false
        setLoading(false)
      }
    },
    [clientId, markLinked, syncFromCalendar],
  )

  useEffect(() => {
    if (!isGoogleLinked()) return
    markLinked()
    void refresh(undefined, true)
  }, [clientId, markLinked, refresh])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && isGoogleLinked()) void refresh(undefined, true)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [refresh])

  useEffect(() => {
    if (!clientId || !isGoogleLinked()) return
    const tick = () => {
      if (!readToken()) return
      void refresh(undefined, true).catch(() => markLinked())
    }
    const token = readToken()
    if (!token) return
    const untilExpiry = Math.max(30_000, token.exp - Date.now() - 90_000)
    const once = window.setTimeout(tick, untilExpiry)
    const loop = window.setInterval(tick, 15 * 60_000)
    return () => {
      window.clearTimeout(once)
      window.clearInterval(loop)
    }
  }, [clientId, connected, markLinked, refresh])

  const pushNow = useCallback(async (s: NonNullable<ReturnType<typeof peekState>>, keepalive = false) => {
    if (!readToken()) return
    if (pushing.current) {
      queuedPush.current = s
      return
    }
    pushing.current = true
    try {
      await pushCloudState(s, { keepalive })
      lastCloudSavedAt.current = s.savedAt ?? Date.now()
      setCloudAt(Date.now())
      setCloudMsg('Saved to Google')
      setCloudNeedsTap(false)
    } catch {
      setCloudMsg('Waiting to sync…')
    } finally {
      pushing.current = false
      const next = queuedPush.current
      queuedPush.current = null
      if (next) void pushNow(next)
    }
  }, [])

  const syncCloud = useCallback(async () => {
    if (!clientId || !isGoogleLinked()) return
    try {
      let token = await ensureGoogleToken(clientId)
      if (!(await tokenHasDriveScope(token.access))) {
        setDriveBlocked('scope')
        setCloudMsg('Google Calendar is linked. Allow Drive so tasks, goals, notes, and projects sync.')
        setCloudNeedsTap(true)
        await ensureGoogleToken(clientId, true)
        return
      }
      const remote = await pullCloudState()
      const local = peekState()
      if (!local) return
      if (!remote) {
        const stamped = { ...local, savedAt: local.savedAt || Date.now() }
        await pushCloudState(stamped)
        lastCloudSavedAt.current = stamped.savedAt ?? Date.now()
        setCloudMsg('Saved to Google')
      } else if (!(local.savedAt ?? 0)) {
        hydrateFromCloud(remote.state, remote.savedAt)
        lastCloudSavedAt.current = remote.savedAt
        setCloudMsg('Loaded from Google')
      } else {
        const merged = mergeStates(local, remote.state)
        const localFp = workFingerprint(local)
        const remoteFp = workFingerprint(remote.state)
        const mergedFp = workFingerprint(merged)
        if (mergedFp !== remoteFp) {
          const stamped = { ...merged, savedAt: Date.now() }
          hydrateFromCloud(stamped, stamped.savedAt)
          await pushCloudState(stamped)
          lastCloudSavedAt.current = stamped.savedAt
          setCloudMsg('Synced across devices')
        } else {
          if (mergedFp !== localFp) hydrateFromCloud(merged, remote.savedAt)
          lastCloudSavedAt.current = Math.max(local.savedAt ?? 0, remote.savedAt)
          setCloudMsg('In sync')
        }
      }
      setCloudAt(Date.now())
      setCloudNeedsTap(false)
      setDriveBlocked(null)
      cloudReady.current = true
      queuedPush.current = null
    } catch (err) {
      const code = err instanceof Error ? err.message : ''
      if (code === 'GOOGLE_DRIVE_API') {
        setDriveBlocked('api')
        setCloudMsg('Enable the Google Drive API so tasks, goals, notes, and projects can sync. Calendar already works.')
        setCloudNeedsTap(true)
      } else if (code === 'GOOGLE_SCOPES') {
        setDriveBlocked('scope')
        setCloudMsg('Google Calendar is linked. Allow Drive so tasks, goals, notes, and projects sync.')
        setCloudNeedsTap(true)
      } else if (code === 'GOOGLE_NEEDS_GESTURE' || code === 'GOOGLE_AUTH') {
        setCloudMsg('Tap to load work from your other device.')
        setCloudNeedsTap(true)
      } else {
        setCloudMsg(code || 'Cloud sync failed')
      }
    }
  }, [clientId, hydrateFromCloud, pushNow])

  useEffect(() => {
    if (clientId) return
    void fetch(`/google-client.json?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const id = typeof j?.clientId === 'string' ? j.clientId.trim() : ''
        if (id) setGoogleClientId(id)
      })
      .catch(() => {})
  }, [clientId, setGoogleClientId])

  useEffect(() => {
    if (!clientId) return
    let cancelled = false
    void (async () => {
      const adopted = await adoptPendingToken(clientId)
      if (cancelled) return
      if (adopted) {
        setConnected(true)
        setEmail(adopted.email)
        await syncCloud()
        return
      }
      if (readToken()) {
        void syncCloud()
        return
      }
      if (!sessionStorage.getItem('sepho.oauth.bounce') && prefersRedirectAuth()) {
        sessionStorage.setItem('sepho.oauth.bounce', '1')
        const silent = Boolean(readLink()?.email) && sessionStorage.getItem('sepho.oauth.error') !== 'interaction_required'
        beginGoogleRedirect(clientId, silent)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [clientId, syncCloud])

  useEffect(() => {
    if (!clientId) return
    let armed = true
    const onUse = () => {
      if (readToken()) {
        if (!cloudReady.current) void syncCloud()
        return
      }
      if (!armed) return
      armed = false
      void ensureGoogleToken(clientId, true).then(() => syncCloud()).catch(() => {
        armed = true
      })
    }
    document.addEventListener('pointerdown', onUse, { capture: true })
    return () => document.removeEventListener('pointerdown', onUse, { capture: true })
  }, [clientId, syncCloud])

  useEffect(() => {
    if (!clientId || !connected) return
    void syncCloud()
    const tick = window.setInterval(() => {
      if (document.visibilityState === 'visible' && readToken()) void syncCloud()
    }, 3000)
    return () => window.clearInterval(tick)
  }, [clientId, connected, syncCloud])

  useEffect(() => {
    if (!clientId || !connected) return
    const stop = onPersist((s) => {
      if (!cloudReady.current) {
        queuedPush.current = s
        return
      }
      if ((s.savedAt ?? 0) <= lastCloudSavedAt.current) return
      window.clearTimeout(pushTimer.current)
      pushTimer.current = window.setTimeout(() => void pushNow(s), 200)
    })
    const leave = () => {
      flushPersist()
      window.clearTimeout(pushTimer.current)
      const s = peekState()
      if (s && cloudReady.current && (s.savedAt ?? 0) > lastCloudSavedAt.current) void pushNow(s, true)
    }
    const resume = () => {
      if (document.visibilityState === 'hidden') return
      void syncCloud()
    }
    const onVis = () => {
      if (document.visibilityState === 'hidden') leave()
      else resume()
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', leave)
    window.addEventListener('pageshow', resume)
    window.addEventListener('focus', resume)
    window.addEventListener('online', resume)
    return () => {
      stop()
      window.clearTimeout(pushTimer.current)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', leave)
      window.removeEventListener('pageshow', resume)
      window.removeEventListener('focus', resume)
      window.removeEventListener('online', resume)
    }
  }, [clientId, connected, pushNow, syncCloud])

  const connect = useCallback(async () => {
    if (!clientId) {
      setError('Add a Google client ID in Settings first.')
      return
    }
    setError('')
    loadingRef.current = true
    setLoading(true)
    try {
      const token = await ensureGoogleToken(clientId, true)
      setConnected(true)
      setEmail(token.email)
      await refresh(undefined, true)
      await syncCloud()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in was cancelled')
      setConnected(isGoogleLinked())
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [clientId, refresh, syncCloud])

  useEffect(() => {
    const onAuthed = () => {
      if (!clientId || readToken()) return
      void connect()
    }
    window.addEventListener('sepho-authed', onAuthed)
    return () => window.removeEventListener('sepho-authed', onAuthed)
  }, [clientId, connect])

  const disconnect = useCallback(() => {
    clearToken(true)
    rangeKey.current = ''
    setConnected(false)
    setEmail('')
    setEvents([])
    setError('')
    setCloudAt(0)
    setCloudMsg('')
    clearCloudFileId()
  }, [])

  const saveToGoogle = useCallback(
    async (event: Omit<CalEvent, 'id' | 'color'> & { id?: string; color?: string; googleId?: string }) => {
      if (!clientId) throw new Error('GOOGLE_NEEDS_GESTURE')
      await ensureGoogleToken(clientId, false).catch(() => ensureGoogleToken(clientId, true))
      const saved = event.googleId
        ? await updateGoogleEvent(event.googleId, { ...event, title: event.title, date: event.date })
        : await createGoogleEvent(event)
      if (saved) {
        setEvents((prev) => {
          const gid = saved.googleId
          const rest = prev.filter((e) => e.googleId !== gid && e.id !== saved.id)
          return [saved, ...rest]
        })
      }
      void refresh(undefined, true)
      return saved
    },
    [clientId, refresh],
  )

  const removeFromGoogle = useCallback(
    async (googleId: string) => {
      await deleteGoogleEvent(googleId)
      await refresh(undefined, true)
    },
    [refresh],
  )

  const value = useMemo(
    () => ({
      connected,
      email,
      events,
      loading,
      error,
      connect,
      disconnect,
      refresh,
      saveToGoogle,
      removeFromGoogle,
      syncCloud,
      cloudAt,
      cloudMsg,
      cloudNeedsTap,
      driveBlocked,
    }),
    [cloudAt, cloudMsg, cloudNeedsTap, connect, connected, disconnect, driveBlocked, email, error, events, loading, refresh, removeFromGoogle, saveToGoogle, syncCloud],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useGoogleCalendar() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useGoogleCalendar must be used within GoogleCalendarProvider')
  return ctx
}

export function mergeCalendars(local: CalEvent[], google: CalEvent[]) {
  const googleKeys = new Set(google.map((e) => (e.googleId ? `${e.googleId}|${e.date}` : '')).filter(Boolean))
  const localOnly = local.filter((e) => !e.googleId || !googleKeys.has(`${e.googleId}|${e.date}`))
  return [...localOnly, ...google]
}
