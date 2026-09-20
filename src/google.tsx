import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  clearToken,
  createGoogleEvent,
  deleteGoogleEvent,
  ensureGoogleToken,
  isGoogleLinked,
  linkedClientId,
  listGoogleEvents,
  readLink,
  readToken,
  updateGoogleEvent,
} from './lib/google-calendar'
import { clearCloudFileId, pullCloudState, pushCloudState } from './lib/cloud-sync'
import { cloudAction } from './lib/sync-policy'
import { addDays } from './lib/dates'
import type { CalEvent } from './lib/types'
import { onPersist, peekState, useStore } from './store'

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
  saveToGoogle: (event: Omit<CalEvent, 'id' | 'color'> & { id?: string; color?: string; googleId?: string }) => Promise<CalEvent | null>
  removeFromGoogle: (googleId: string) => Promise<void>
}

const Ctx = createContext<GCal | null>(null)

export function GoogleCalendarProvider({ children }: { children: ReactNode }) {
  const { state, syncFromCalendar, hydrateFromCloud } = useStore()
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
  const pushing = useRef(false)

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

  const syncCloud = useCallback(async () => {
    if (!clientId || !isGoogleLinked()) return
    try {
      await ensureGoogleToken(clientId)
      const remote = await pullCloudState()
      const local = peekState()
      const action = cloudAction(local?.savedAt ?? 0, remote ? remote.savedAt : null)
      if (action === 'pull' && remote) {
        hydrateFromCloud(remote.state, remote.savedAt)
        setCloudMsg('Loaded from Google')
      } else if (action === 'push' && local) {
        const stamped = { ...local, savedAt: local.savedAt || Date.now() }
        if (!local.savedAt) hydrateFromCloud(stamped, stamped.savedAt ?? Date.now())
        await pushCloudState(stamped)
        setCloudMsg('Saved to Google')
      } else {
        setCloudMsg('In sync')
      }
      setCloudAt(Date.now())
    } catch (err) {
      const code = err instanceof Error ? err.message : ''
      if (code === 'GOOGLE_SCOPES') {
        setCloudMsg('Click Connect Google again and allow Drive access so phone and computer stay in sync.')
      } else if (code === 'GOOGLE_NEEDS_GESTURE' || code === 'GOOGLE_AUTH') {
        setCloudMsg('Click Sync Google to resume device sync.')
      } else {
        setCloudMsg(code || 'Cloud sync failed')
      }
    }
  }, [clientId, hydrateFromCloud])

  useEffect(() => {
    if (events.length) syncFromCalendar(events)
  }, [events, syncFromCalendar])

  useEffect(() => {
    if (!clientId || !connected) return
    void syncCloud()
  }, [clientId, connected, syncCloud])

  useEffect(() => {
    if (!clientId || !connected) return
    const push = (s: Parameters<Parameters<typeof onPersist>[0]>[0]) => {
      if (pushing.current || !readToken()) return
      pushing.current = true
      void pushCloudState(s)
        .then(() => {
          setCloudAt(Date.now())
          setCloudMsg('Saved to Google')
        })
        .catch(() => {
          setCloudMsg('Waiting to sync…')
        })
        .finally(() => {
          pushing.current = false
        })
    }
    let timer = 0
    const stop = onPersist((s) => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => push(s), 1600)
    })
    const onVis = () => {
      if (document.visibilityState === 'visible') void syncCloud()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      stop()
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [clientId, connected, syncCloud])

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
      await refresh(undefined, true)
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
    }),
    [cloudAt, cloudMsg, connect, connected, disconnect, email, error, events, loading, refresh, removeFromGoogle, saveToGoogle, syncCloud],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useGoogleCalendar() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useGoogleCalendar must be used within GoogleCalendarProvider')
  return ctx
}

export function mergeCalendars(local: CalEvent[], google: CalEvent[]) {
  const googleIds = new Set(google.map((e) => e.googleId).filter(Boolean))
  const localOnly = local.filter((e) => !e.googleId || !googleIds.has(e.googleId))
  return [...localOnly, ...google]
}
