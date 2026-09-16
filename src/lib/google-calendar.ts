import { addDays, parseISO, toISO } from './dates'
import { colorFromKey, type CalEvent } from './types'

export const GOOGLE_BLUE = '#4285f4'

const GOOGLE_EVENT_COLORS: Record<string, string> = {
  '1': '#a4bdfc',
  '2': '#7ae7bf',
  '3': '#dbadff',
  '4': '#ff887c',
  '5': '#fbd75b',
  '6': '#ffb878',
  '7': '#46d6db',
  '8': '#e1e1e1',
  '9': '#5484ed',
  '10': '#51b749',
  '11': '#dc2127',
}
const SCOPE = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ')
const TOKEN_KEY = 'north.gcal.token'

type TokenBlob = { access: string; exp: number; email: string }

type GEvent = {
  id?: string
  summary?: string
  description?: string
  location?: string
  colorId?: string
  start?: { date?: string; dateTime?: string }
  end?: { date?: string; dateTime?: string }
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string
            scope: string
            enable_granular_consent?: boolean
            callback: (resp: { access_token?: string; error?: string; expires_in?: string | number }) => void
          }) => { requestAccessToken: (opts?: { prompt?: string }) => void }
          revoke: (token: string, done?: () => void) => void
        }
      }
    }
  }
}

export function readToken(): TokenBlob | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as TokenBlob
    if (!parsed.access || parsed.exp < Date.now() + 15_000) return null
    return parsed
  } catch {
    return null
  }
}

function writeToken(blob: TokenBlob) {
  sessionStorage.setItem(TOKEN_KEY, JSON.stringify(blob))
}

export function clearToken() {
  const t = readToken()
  if (t && window.google?.accounts.oauth2.revoke) window.google.accounts.oauth2.revoke(t.access)
  sessionStorage.removeItem(TOKEN_KEY)
}

function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-gis]')
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Google sign-in failed to load')))
      return
    }
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.dataset.gis = 'true'
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Google sign-in failed to load'))
    document.head.appendChild(s)
  })
}

export function requestGoogleToken(clientId: string, prompt: '' | 'consent' = 'consent'): Promise<TokenBlob> {
  return loadGis().then(
    () =>
      new Promise((resolve, reject) => {
        if (!window.google?.accounts.oauth2) {
          reject(new Error('Google sign-in is unavailable'))
          return
        }
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPE,
          enable_granular_consent: false,
          callback: async (resp) => {
            if (resp.error || !resp.access_token) {
              const denied = resp.error === 'access_denied'
              reject(
                new Error(
                  denied
                    ? 'Google blocked the app because it is still in Testing. In Google Cloud → OAuth consent screen → Test users, add kensbrivaus103@gmail.com, wait a minute, then Connect again with that same account.'
                    : resp.error || 'Google permission was not granted',
                ),
              )
              return
            }
            const seconds = Number(resp.expires_in ?? 3600)
            const email = await fetchEmail(resp.access_token)
            const blob = { access: resp.access_token, exp: Date.now() + seconds * 1000, email }
            writeToken(blob)
            resolve(blob)
          },
        })
        client.requestAccessToken({ prompt })
      }),
  )
}

async function fetchEmail(access: string) {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access}` },
    })
    if (!res.ok) return ''
    const data = (await res.json()) as { email?: string }
    return data.email ?? ''
  } catch {
    return ''
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = readToken()
  if (!token) throw new Error('Google Calendar is not connected')
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token.access}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (res.status === 401) {
    throw new Error('GOOGLE_AUTH')
  }
  if (!res.ok) {
    const text = await res.text()
    if (res.status === 403 && /insufficient|ACCESS_TOKEN_SCOPE/i.test(text)) {
      throw new Error('GOOGLE_SCOPES')
    }
    if (res.status === 403 && /has not been used|is disabled|accessNotConfigured/i.test(text)) {
      throw new Error(
        'Enable the Google Calendar API, then Connect again: https://console.cloud.google.com/apis/library/calendar-json.googleapis.com?project=969056584851',
      )
    }
    throw new Error(text.slice(0, 180) || `Google Calendar error ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

function hhmm(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function localDateTime(date: string, time: string) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  return { dateTime: `${date}T${time}:00`, timeZone: tz }
}

export function fromGoogleEvent(item: GEvent): CalEvent[] {
  if (!item.id) return []
  const start = item.start
  const end = item.end
  if (!start) return []
  const base = {
    googleId: item.id,
    title: item.summary || '(No title)',
    notes: item.description ?? '',
    color: (item.colorId && GOOGLE_EVENT_COLORS[item.colorId]) || colorFromKey(item.id),
    location: item.location ?? '',
  }
  if (start.date) {
    const last = end?.date ?? toISO(addDays(parseISO(start.date), 1))
    const days: CalEvent[] = []
    for (let d = parseISO(start.date); toISO(d) < last; d = addDays(d, 1)) {
      days.push({ ...base, id: `gcal:${item.id}:${toISO(d)}`, date: toISO(d), allDay: true })
    }
    return days.length ? days : [{ ...base, id: `gcal:${item.id}`, date: start.date, allDay: true }]
  }
  if (!start.dateTime) return []
  const s = new Date(start.dateTime)
  const e = end?.dateTime ? new Date(end.dateTime) : undefined
  return [
    {
      ...base,
      id: `gcal:${item.id}`,
      date: toISO(s),
      start: hhmm(s),
      end: e ? hhmm(e) : undefined,
      allDay: false,
    },
  ]
}

function toGoogleBody(event: Pick<CalEvent, 'title' | 'notes' | 'date' | 'start' | 'end' | 'allDay' | 'location'>) {
  const body: GEvent = {
    summary: event.title,
    description: event.notes || undefined,
    location: event.location || undefined,
  }
  if (event.allDay || !event.start) {
    body.start = { date: event.date }
    body.end = { date: toISO(addDays(parseISO(event.date), 1)) }
  } else {
    body.start = localDateTime(event.date, event.start)
    body.end = localDateTime(event.date, event.end || event.start)
  }
  return body
}

export async function listGoogleEvents(timeMin: Date, timeMax: Date): Promise<CalEvent[]> {
  const out: CalEvent[] = []
  let pageToken = ''
  for (let i = 0; i < 4; i++) {
    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    })
    if (pageToken) params.set('pageToken', pageToken)
    const data = await api<{ items?: GEvent[]; nextPageToken?: string }>(`/calendars/primary/events?${params}`)
    out.push(...(data.items ?? []).flatMap(fromGoogleEvent))
    if (!data.nextPageToken) break
    pageToken = data.nextPageToken
  }
  return out
}

export async function createGoogleEvent(event: Omit<CalEvent, 'id' | 'color'> & { color?: string }) {
  const created = await api<GEvent>('/calendars/primary/events', {
    method: 'POST',
    body: JSON.stringify(toGoogleBody(event)),
  })
  return fromGoogleEvent(created)[0] ?? null
}

export async function updateGoogleEvent(googleId: string, event: Partial<CalEvent> & Pick<CalEvent, 'title' | 'date'>) {
  const created = await api<GEvent>(`/calendars/primary/events/${encodeURIComponent(googleId)}`, {
    method: 'PATCH',
    body: JSON.stringify(toGoogleBody({
      title: event.title,
      notes: event.notes ?? '',
      date: event.date,
      start: event.start,
      end: event.end,
      allDay: Boolean(event.allDay || !event.start),
      location: event.location ?? '',
    })),
  })
  return fromGoogleEvent(created)[0] ?? null
}

export async function deleteGoogleEvent(googleId: string) {
  await api(`/calendars/primary/events/${encodeURIComponent(googleId)}`, { method: 'DELETE' })
}
