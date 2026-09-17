import { readToken } from './google-calendar'
import type { State } from './types'

const FILE_KEY = 'north.cloud.file'
const FILE_NAME = 'sepho-state.json'

export type CloudSnapshot = { v: 1; savedAt: number; state: State }

function tokenOrThrow() {
  const token = readToken()
  if (!token) throw new Error('GOOGLE_NEEDS_GESTURE')
  return token
}

async function driveJson<T>(url: string, init?: RequestInit): Promise<T> {
  const token = tokenOrThrow()
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token.access}`,
      ...(init?.headers ?? {}),
    },
  })
  if (res.status === 401) throw new Error('GOOGLE_AUTH')
  if (res.status === 403) throw new Error('GOOGLE_SCOPES')
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text.slice(0, 160) || `Drive error ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

async function findFileId() {
  const cached = localStorage.getItem(FILE_KEY)
  if (cached) return cached
  const q = encodeURIComponent(`name = '${FILE_NAME}'`)
  const data = await driveJson<{ files?: { id: string }[] }>(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name)&q=${q}`,
  )
  const id = data.files?.[0]?.id
  if (id) localStorage.setItem(FILE_KEY, id)
  return id ?? null
}

export async function pullCloudState(): Promise<CloudSnapshot | null> {
  const id = await findFileId()
  if (!id) return null
  const token = tokenOrThrow()
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`, {
    headers: { Authorization: `Bearer ${token.access}` },
  })
  if (res.status === 401) throw new Error('GOOGLE_AUTH')
  if (res.status === 403) throw new Error('GOOGLE_SCOPES')
  if (res.status === 404) {
    localStorage.removeItem(FILE_KEY)
    return null
  }
  if (!res.ok) throw new Error(`Drive error ${res.status}`)
  const data = (await res.json()) as Partial<CloudSnapshot>
  if (!data?.state || typeof data.state !== 'object') return null
  return { v: 1, savedAt: Number(data.savedAt) || 0, state: data.state }
}

export async function pushCloudState(state: State) {
  const snapshot: CloudSnapshot = { v: 1, savedAt: state.savedAt ?? Date.now(), state }
  const json = JSON.stringify(snapshot)
  const token = tokenOrThrow()
  const id = await findFileId()
  if (id) {
    const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(id)}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token.access}`,
        'Content-Type': 'application/json',
      },
      body: json,
    })
    if (res.status === 401) throw new Error('GOOGLE_AUTH')
    if (res.status === 403) throw new Error('GOOGLE_SCOPES')
    if (res.status === 404) {
      localStorage.removeItem(FILE_KEY)
      return pushCloudState(state)
    }
    if (!res.ok) throw new Error(`Drive error ${res.status}`)
    return
  }
  const boundary = 'sepho_sync'
  const meta = JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'] })
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${json}\r\n--${boundary}--`
  const created = await driveJson<{ id?: string }>('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })
  if (created.id) localStorage.setItem(FILE_KEY, created.id)
}

export function clearCloudFileId() {
  localStorage.removeItem(FILE_KEY)
}
