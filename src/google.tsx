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
import { addDays } from './lib/dates'
import type { CalEvent } from './lib/types'
import { useStore } from './store'

type GCal = {
  connected: boolean
  email: string
  events: CalEvent[]
  loading: boolean
  error: string
  connect: () => Promise<void>
  disconnect: () => void
  refresh: (around?: Date, force?: boolean) => Promise<void>
  saveToGoogle: (event: Omit<CalEvent, 'id' | 'color'> & { id?: string; color?: string; googleId?: string }) => Promise<CalEvent | null>
  removeFromGoogle: (googleId: string) => Promise<void>
}

const Ctx = createContext<GCal | null>(null)

export function GoogleCalendarProvider({ children }: { children: ReactNode }) {
  const { state, syncFromCalendar, updateSettings } = useStore()
  const clientId = state.settings.googleClientId.trim() || linkedClientId()
  const [email, setEmail] = useState(() => readLink()?.email || '')
  const [events, setEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [connected, setConnected] = useState(() => isGoogleLinked())
  const rangeKey = useRef('')
  const aroundRef = useRef<Date>(new Date())
  const loadingRef = useRef(false)

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
        if (code === 'GOOGLE_NEEDS_GESTURE' || isGoogleLinked()) {
          markLinked()
          setError(
            code === 'GOOGLE_SCOPES'
              ? 'Google signed you in without Calendar access. Click Connect again and allow calendar permission.'
              : 'Calendar is still linked. Click Sync Google to resume.',
          )
          return
        }
        setError(code && code !== 'GOOGLE_AUTH' ? code : 'Google Calendar needs to reconnect')
        setConnected(false)
      } finally {
        loadingRef.current = false
        setLoading(false)
      }
    },
    [clientId, markLinked],
  )

  useEffect(() => {
    if (!state.settings.googleClientId.trim() && linkedClientId()) {
      updateSettings({ googleClientId: linkedClientId() })
    }
  }, [state.settings.googleClientId, updateSettings])

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
      if (!isGoogleLinked()) return
      void ensureGoogleToken(clientId)
        .then(() => refresh(undefined, true))
        .catch(() => markLinked())
    }
    const token = readToken()
    const untilExpiry = token ? Math.max(20_000, token.exp - Date.now() - 90_000) : 20_000
    const once = window.setTimeout(tick, untilExpiry)
    const loop = window.setInterval(tick, 12 * 60_000)
    return () => {
      window.clearTimeout(once)
      window.clearInterval(loop)
    }
  }, [clientId, connected, markLinked, refresh])

  useEffect(() => {
    const resume = () => {
      if (!clientId || !isGoogleLinked() || readToken() || loadingRef.current) return
      void refresh(undefined, true)
    }
    document.addEventListener('pointerdown', resume, true)
    document.addEventListener('keydown', resume, true)
    return () => {
      document.removeEventListener('pointerdown', resume, true)
      document.removeEventListener('keydown', resume, true)
    }
  }, [clientId, refresh])

  useEffect(() => {
    if (events.length) syncFromCalendar(events)
  }, [events, syncFromCalendar])

  const connect = useCallback(async () => {
    if (!clientId) {
      setError('Add a Google client ID in Settings first.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const token = await ensureGoogleToken(clientId, true)
      setConnected(true)
      setEmail(token.email)
      await refresh(undefined, true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in was cancelled')
      setConnected(isGoogleLinked())
    } finally {
      setLoading(false)
    }
  }, [clientId, refresh])

  const disconnect = useCallback(() => {
    clearToken(true)
    rangeKey.current = ''
    setConnected(false)
    setEmail('')
    setEvents([])
    setError('')
  }, [])

  const saveToGoogle = useCallback(
    async (event: Omit<CalEvent, 'id' | 'color'> & { id?: string; color?: string; googleId?: string }) => {
      const saved = event.googleId
        ? await updateGoogleEvent(event.googleId, { ...event, title: event.title, date: event.date })
        : await createGoogleEvent(event)
      await refresh(undefined, true)
      return saved
    },
    [refresh],
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
    }),
    [connect, connected, disconnect, email, error, events, loading, refresh, removeFromGoogle, saveToGoogle],
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
