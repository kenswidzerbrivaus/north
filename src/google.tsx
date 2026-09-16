import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  clearToken,
  createGoogleEvent,
  deleteGoogleEvent,
  ensureGoogleToken,
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
  const { state, syncFromCalendar } = useStore()
  const clientId = state.settings.googleClientId.trim()
  const [email, setEmail] = useState('')
  const [events, setEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [connected, setConnected] = useState(false)
  const rangeKey = useRef('')

  const refresh = useCallback(
    async (around?: Date, force = false) => {
      const center = around ?? new Date()
      const key = `${center.getFullYear()}-${center.getMonth()}`
      const linked = readLink()
      if (!clientId || (!linked && !readToken())) {
        setConnected(false)
        setEvents([])
        return
      }
      if (!force && rangeKey.current === key && readToken()) return
      rangeKey.current = key
      setLoading(true)
      setError('')
      setConnected(true)
      setEmail(linked?.email || readToken()?.email || '')
      const load = () => {
        const from = addDays(center, -40)
        const to = addDays(center, 70)
        return listGoogleEvents(from, to)
      }
      try {
        await ensureGoogleToken(clientId)
        const items = await load()
        setEvents(items)
        setConnected(true)
        setEmail(readToken()?.email || linked?.email || '')
        setError('')
      } catch (err) {
        rangeKey.current = ''
        const code = err instanceof Error ? err.message : ''
        if ((code === 'GOOGLE_AUTH' || code === 'GOOGLE_SCOPES') && clientId) {
          try {
            await ensureGoogleToken(clientId, false)
            rangeKey.current = key
            const items = await load()
            setEvents(items)
            setConnected(true)
            setEmail(readToken()?.email || linked?.email || '')
            setError('')
            return
          } catch {
            rangeKey.current = ''
          }
        }
        setError(
          code === 'GOOGLE_SCOPES'
            ? 'Google signed you in without Calendar access. Click Connect again and allow calendar permission.'
            : readLink()
              ? 'Calendar is still linked. Sepho will refresh when Google is ready — or click Connect if events look stale.'
              : code && code !== 'GOOGLE_AUTH'
                ? code
                : 'Google Calendar needs to reconnect',
        )
        setConnected(Boolean(readLink() || readToken()))
      } finally {
        setLoading(false)
      }
    },
    [clientId],
  )

  useEffect(() => {
    if (!clientId) return
    const linked = readLink()
    const token = readToken()
    if (!linked && !token) return
    setConnected(true)
    setEmail(linked?.email || token?.email || '')
    void refresh(undefined, true)
  }, [clientId, refresh])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && (readLink() || readToken())) void refresh(undefined, true)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [refresh])

  useEffect(() => {
    if (!clientId || !connected) return
    const token = readToken()
    const wait = token ? Math.max(15_000, token.exp - Date.now() - 120_000) : 15_000
    const id = window.setTimeout(() => {
      void ensureGoogleToken(clientId).then(() => refresh(undefined, true))
    }, wait)
    return () => window.clearTimeout(id)
  }, [clientId, connected, refresh])

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
      setConnected(false)
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
