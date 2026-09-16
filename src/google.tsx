import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
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
  refresh: (around?: Date) => Promise<void>
  saveToGoogle: (event: Omit<CalEvent, 'id' | 'color'> & { id?: string; color?: string; googleId?: string }) => Promise<CalEvent | null>
  removeFromGoogle: (googleId: string) => Promise<void>
}

const Ctx = createContext<GCal | null>(null)

export function GoogleCalendarProvider({ children }: { children: ReactNode }) {
  const { state } = useStore()
  const clientId = state.settings.googleClientId.trim()
  const [email, setEmail] = useState('')
  const [events, setEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [connected, setConnected] = useState(false)

  const refresh = useCallback(
    async (around?: Date) => {
      if (!readToken()) {
        setConnected(false)
        setEvents([])
        return
      }
      setLoading(true)
      setError('')
      try {
        const center = around ?? new Date()
        const from = addDays(center, -40)
        const to = addDays(center, 70)
        const items = await listGoogleEvents(from, to)
        setEvents(items)
        setConnected(true)
        setEmail(readToken()?.email ?? '')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load Google Calendar')
        setConnected(Boolean(readToken()))
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    const existing = readToken()
    if (!existing || !clientId) return
    setConnected(true)
    setEmail(existing.email)
    void refresh()
  }, [clientId, refresh])

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
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in was cancelled')
      setConnected(false)
    } finally {
      setLoading(false)
    }
  }, [clientId, refresh])

  const disconnect = useCallback(() => {
    clearToken()
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
      await refresh()
      return saved
    },
    [refresh],
  )

  const removeFromGoogle = useCallback(
    async (googleId: string) => {
      await deleteGoogleEvent(googleId)
      await refresh()
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
