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
const LINK_KEY = 'north.gcal.link'

type TokenBlob = { access: string; exp: number; email: string }
type LinkBlob = { email: string; clientId?: string; linkedAt?: string }

let tokenWait: Promise<TokenBlob> | null = null
let gisClient: { requestAccessToken: (opts?: { prompt?: string }) => void } | null = null
let gisClientId = ''
let pendingAuth: {
  resolve: (blob: TokenBlob) => void
  reject: (err: Error) => void
  clientId: string
} | null = null

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
            hint?: string
            enable_granular_consent?: boolean
            include_granted_scopes?: boolean
            callback: (resp: { access_token?: string; error?: string; expires_in?: string | number }) => void
            error_callback?: (err: { type?: string; message?: string }) => void
          }) => { requestAccessToken: (opts?: { prompt?: string }) => void }
          revoke: (token: string, done?: () => void) => void
        }
      }
    }
  }
}

export function readLink(): LinkBlob | null {
  try {
    const raw = localStorage.getItem(LINK_KEY)
    if (!raw) return null
    return JSON.parse(raw) as LinkBlob
  } catch {
    return null
  }
}

export function isGoogleLinked() {
  return Boolean(readLink()?.email || readStoredToken()?.access)
}

export function readStoredToken(): TokenBlob | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as TokenBlob
    if (!parsed.access) return null
    return parsed
  } catch {
    return null
  }
}

export function readToken(): TokenBlob | null {
  const parsed = readStoredToken()
  if (!parsed || parsed.exp < Date.now() + 20_000) return null
  return parsed
}

function writeLink(email: string, clientId?: string) {
  const prev = readLink()
  localStorage.setItem(
    LINK_KEY,
    JSON.stringify({
      email: email || prev?.email || '',
      clientId: clientId || prev?.clientId,
      linkedAt: prev?.linkedAt || new Date().toISOString(),
    } satisfies LinkBlob),
  )
}

function writeToken(blob: TokenBlob, clientId?: string) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(blob))
  writeLink(blob.email, clientId)
  sessionStorage.removeItem(TOKEN_KEY)
}

function expireStoredToken() {
  const t = readStoredToken()
  if (!t) return
  localStorage.setItem(TOKEN_KEY, JSON.stringify({ ...t, exp: 0 }))
}

export function clearToken(revoke = true) {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    const parsed = raw ? (JSON.parse(raw) as TokenBlob) : null
    if (revoke && parsed?.access && window.google?.accounts.oauth2.revoke) {
      window.google.accounts.oauth2.revoke(parsed.access)
    }
  } catch {
    /* ignore */
  }
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(LINK_KEY)
  sessionStorage.removeItem(TOKEN_KEY)
}

function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const wait = () => {
      if (window.google?.accounts?.oauth2) {
        resolve()
        return
      }
      if (Date.now() - start > 12_000) {
        reject(new Error('Google sign-in failed to load'))
        return
      }
      window.setTimeout(wait, 40)
    }
    let el = document.querySelector<HTMLScriptElement>('script[src*="accounts.google.com/gsi/client"]')
    if (!el) {
      el = document.createElement('script')
      el.src = 'https://accounts.google.com/gsi/client'
      el.async = true
      el.dataset.gis = 'true'
      el.onerror = () => reject(new Error('Google sign-in failed to load'))
      document.head.appendChild(el)
    }
    el.addEventListener('load', wait, { once: true })
    wait()
  })
}

function failPending(err: Error) {
  const p = pendingAuth
  pendingAuth = null
  p?.reject(err)
}

async function finishToken(access: string, expiresIn: number, clientId: string) {
  const email = (await fetchEmail(access)) || readLink()?.email || readStoredToken()?.email || ''
  const blob: TokenBlob = { access, exp: Date.now() + Math.max(60, expiresIn) * 1000, email }
  writeToken(blob, clientId)
  return blob
}

async function gisClientFor(clientId: string) {
  await loadGis()
  if (!window.google?.accounts.oauth2) throw new Error('Google sign-in is unavailable')
  if (gisClient && gisClientId === clientId) return gisClient
  gisClientId = clientId
  gisClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPE,
    hint: readLink()?.email || readStoredToken()?.email,
    enable_granular_consent: false,
    include_granted_scopes: true,
    callback: (resp) => {
      const waiter = pendingAuth
      pendingAuth = null
      if (!waiter) return
      if (resp.error || !resp.access_token) {
        const denied = resp.error === 'access_denied'
        waiter.reject(
          new Error(
            denied
              ? 'Google blocked the app because it is still in Testing. In Google Cloud → OAuth consent screen → Test users, add kensbrivaus103@gmail.com, wait a minute, then Connect again with that same account.'
              : resp.error === 'popup_closed_by_user'
                ? 'GOOGLE_NEEDS_GESTURE'
                : resp.error || 'Google permission was not granted',
          ),
        )
        return
      }
      void finishToken(resp.access_token, Number(resp.expires_in ?? 3600), waiter.clientId).then(waiter.resolve, waiter.reject)
    },
    error_callback: (err) => {
      const type = err?.type || ''
      if (type === 'popup_closed' || type === 'popup_failed_to_open') {
        failPending(new Error('GOOGLE_NEEDS_GESTURE'))
        return
      }
      failPending(new Error(err?.message || type || 'GOOGLE_NEEDS_GESTURE'))
    },
  })
  return gisClient
}

export function requestGoogleToken(clientId: string, prompt: '' | 'consent' = 'consent'): Promise<TokenBlob> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(
      () => {
        if (pendingAuth?.resolve !== wrappedResolve) return
        failPending(new Error(prompt ? 'Google sign-in timed out' : 'GOOGLE_NEEDS_GESTURE'))
      },
      prompt ? 120_000 : 8_000,
    )
    const wrappedResolve = (blob: TokenBlob) => {
      window.clearTimeout(timeout)
      resolve(blob)
    }
    const wrappedReject = (err: Error) => {
      window.clearTimeout(timeout)
      reject(err)
    }
    pendingAuth = { clientId, resolve: wrappedResolve, reject: wrappedReject }
    void gisClientFor(clientId)
      .then((client) => client.requestAccessToken({ prompt }))
      .catch((err) => failPending(err instanceof Error ? err : new Error('Google sign-in failed to load')))
  })
}

export function ensureGoogleToken(clientId: string, consent = false): Promise<TokenBlob> {
  const fresh = readToken()
  if (fresh && !consent) return Promise.resolve(fresh)
  if (tokenWait && !consent) return tokenWait
  tokenWait = requestGoogleToken(clientId, consent ? 'consent' : '').finally(() => {
    tokenWait = null
  })
  return tokenWait
}

export function linkedClientId() {
  return readLink()?.clientId || ''
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
  if (!token) throw new Error(isGoogleLinked() ? 'GOOGLE_NEEDS_GESTURE' : 'Google Calendar is not connected')
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token.access}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (res.status === 401) {
    expireStoredToken()
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
