import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  clearToken,
  createGoogleEvent,
  deleteGoogleEvent,
  listGoogleEvents,
  readToken,
  requestGoogleToken,
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
      if (!force && rangeKey.current === key && readToken()) return
      if (!readToken()) {
        setConnected(false)
        setEvents([])
        return
      }
      rangeKey.current = key
      setLoading(true)
      setError('')
      const load = () => {
        const from = addDays(center, -40)
        const to = addDays(center, 70)
        return listGoogleEvents(from, to)
      }
      try {
        const items = await load()
        setEvents(items)
        setConnected(true)
        setEmail(readToken()?.email ?? '')
      } catch (err) {
        rangeKey.current = ''
        if (err instanceof Error && err.message === 'GOOGLE_AUTH' && clientId) {
          try {
            await requestGoogleToken(clientId, '')
            rangeKey.current = key
            const items = await load()
            setEvents(items)
            setConnected(true)
            setEmail(readToken()?.email ?? '')
            return
          } catch {
            rangeKey.current = ''
          }
        }
        setError(err instanceof Error && err.message !== 'GOOGLE_AUTH' ? err.message : 'Google Calendar needs to reconnect')
        setConnected(Boolean(readToken()))
      } finally {
        setLoading(false)
      }
    },
    [clientId],
  )

  useEffect(() => {
    const existing = readToken()
    if (!existing || !clientId) return
    setConnected(true)
    setEmail(existing.email)
    void refresh()
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
      const token = await requestGoogleToken(clientId, readToken() ? '' : 'consent')
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
    clearToken()
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
