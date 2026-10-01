import { uid } from './id'
import { todayISO } from './dates'
import { ROUTES } from './types'
import type {
  Attention,
  AttentionSpace,
  AttentionVisit,
  BypassLog,
  DetoxConfig,
  FocusProfile,
  InterventionKind,
  SpaceAppearance,
  SpaceItem,
  ToolId,
  ToolLock,
} from './types'

export const TOOL_IDS: ToolId[] = ROUTES.map((r) => r.id)

export const TOOL_LABEL: Record<ToolId, string> = Object.fromEntries(ROUTES.map((r) => [r.id, r.label])) as Record<
  ToolId,
  string
>

export const INTERVENTION_LABEL: Record<InterventionKind, string> = {
  breath: 'Breathing countdown',
  outside: 'Step outside',
  reps: 'Physical reps',
  pause: 'Are you sure?',
}

export const WALLPAPERS: { id: SpaceAppearance['wallpaper']; label: string }[] = [
  { id: 'dusk', label: 'Dusk' },
  { id: 'dune', label: 'Dune' },
  { id: 'ink', label: 'Ink' },
  { id: 'fog', label: 'Fog' },
  { id: 'none', label: 'None' },
]

export function defaultAppearance(): SpaceAppearance {
  return {
    font: 'system',
    textSize: 28,
    align: 'center',
    spacing: 'regular',
    wallpaper: 'dusk',
    mono: false,
  }
}

function items(ids: ToolId[]): SpaceItem[] {
  return ids.map((toolId) => ({ toolId, label: TOOL_LABEL[toolId] }))
}

export function defaultSpaces(): AttentionSpace[] {
  const look = defaultAppearance()
  return [
    {
      id: 'work',
      name: 'Work',
      items: items(['today', 'tasks', 'calendar', 'projects', 'focus', 'notes']),
      appearance: look,
    },
    {
      id: 'personal',
      name: 'Personal',
      items: items(['today', 'habits', 'journal', 'notes', 'goals']),
      appearance: { ...look, wallpaper: 'fog' },
    },
    {
      id: 'deep',
      name: 'Deep Work',
      items: items(['today', 'focus', 'notes']),
      appearance: { ...look, wallpaper: 'ink' },
    },
    {
      id: 'evening',
      name: 'Evening',
      items: items(['journal', 'notes', 'habits', 'settings']),
      appearance: { ...look, wallpaper: 'dune' },
    },
  ]
}

export function defaultProfiles(): FocusProfile[] {
  return [
    {
      id: 'work',
      name: 'Work',
      spaceId: 'work',
      extraLockToolIds: ['journal'],
      days: [1, 2, 3, 4, 5],
      startMin: 9 * 60,
      endMin: 17 * 60,
      enabled: false,
    },
    {
      id: 'sleep',
      name: 'Sleep',
      spaceId: 'evening',
      extraLockToolIds: ['projects', 'tasks', 'calendar', 'goals'],
      days: [],
      startMin: 22 * 60,
      endMin: 6 * 60,
      enabled: false,
    },
    {
      id: 'study',
      name: 'Study',
      spaceId: 'deep',
      extraLockToolIds: ['journal', 'habits', 'projects'],
      days: [],
      startMin: 9 * 60,
      endMin: 12 * 60,
      enabled: false,
    },
    {
      id: 'meals',
      name: 'Meals',
      spaceId: 'personal',
      extraLockToolIds: ['projects', 'goals', 'notes'],
      days: [],
      startMin: 12 * 60,
      endMin: 13 * 60,
      enabled: false,
    },
  ]
}

export function defaultAttention(): Attention {
  return {
    onboarded: false,
    spaces: defaultSpaces(),
    activeSpaceId: 'work',
    locks: [],
    profiles: defaultProfiles(),
    detox: { active: false, whitelist: ['today', 'journal'] },
    visits: [],
    bypasses: [],
    quietDays: [],
    showWeather: false,
    showTime: true,
    appearance: defaultAppearance(),
  }
}

export function isToolId(id: string): id is ToolId {
  return (TOOL_IDS as string[]).includes(id)
}

function asToolId(id: unknown): ToolId | null {
  return typeof id === 'string' && isToolId(id) ? id : null
}

function clampMin(n: unknown, fallback = 0) {
  const v = Number(n)
  if (!Number.isFinite(v)) return fallback
  return Math.max(0, Math.min(24 * 60, Math.round(v)))
}

export function normalizeAppearance(raw: Partial<SpaceAppearance> | null | undefined): SpaceAppearance {
  const d = defaultAppearance()
  const font = raw?.font === 'serif' || raw?.font === 'mono' ? raw.font : 'system'
  const align = raw?.align === 'left' ? 'left' : 'center'
  const spacing = raw?.spacing === 'tight' || raw?.spacing === 'loose' ? raw.spacing : 'regular'
  const wallpaper =
    raw?.wallpaper === 'dune' || raw?.wallpaper === 'ink' || raw?.wallpaper === 'fog' || raw?.wallpaper === 'none'
      ? raw.wallpaper
      : 'dusk'
  const textSize = Number(raw?.textSize)
  return {
    font,
    align,
    spacing,
    wallpaper,
    mono: Boolean(raw?.mono),
    textSize: Number.isFinite(textSize) ? Math.max(16, Math.min(40, Math.round(textSize))) : d.textSize,
  }
}

export function normalizeAttention(raw: Partial<Attention> | null | undefined): Attention {
  const d = defaultAttention()
  if (!raw || typeof raw !== 'object') return d
  const spaces = Array.isArray(raw.spaces) && raw.spaces.length ? raw.spaces.map(normSpace) : d.spaces
  const spaceIds = new Set(spaces.map((s) => s.id))
  const activeSpaceId = typeof raw.activeSpaceId === 'string' && spaceIds.has(raw.activeSpaceId) ? raw.activeSpaceId : spaces[0]?.id ?? d.activeSpaceId
  const profiles = Array.isArray(raw.profiles) && raw.profiles.length ? raw.profiles.map((p) => normProfile(p, spaceIds)) : d.profiles
  const activeProfileId =
    typeof raw.activeProfileId === 'string' && profiles.some((p) => p.id === raw.activeProfileId) ? raw.activeProfileId : undefined
  return {
    onboarded: Boolean(raw.onboarded),
    spaces,
    activeSpaceId,
    locks: Array.isArray(raw.locks) ? raw.locks.map(normLock).filter((l): l is ToolLock => Boolean(l)) : [],
    profiles,
    activeProfileId,
    detox: normDetox(raw.detox),
    visits: trimVisits(Array.isArray(raw.visits) ? raw.visits.map(normVisit).filter((v): v is AttentionVisit => Boolean(v)) : []),
    bypasses: Array.isArray(raw.bypasses) ? raw.bypasses.map(normBypass).filter((b): b is BypassLog => Boolean(b)).slice(0, 200) : [],
    quietDays: Array.isArray(raw.quietDays) ? [...new Set(raw.quietDays.filter((x) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x)))].sort() : [],
    showWeather: Boolean(raw.showWeather),
    showTime: raw.showTime !== false,
    appearance: normalizeAppearance(raw.appearance),
  }
}

function normSpace(s: Partial<AttentionSpace>): AttentionSpace {
  const id = typeof s.id === 'string' && s.id.trim() ? s.id : uid()
  const name = typeof s.name === 'string' && s.name.trim() ? s.name.trim() : 'Space'
  const seen = new Set<ToolId>()
  const items: SpaceItem[] = []
  for (const it of Array.isArray(s.items) ? s.items : []) {
    const toolId = asToolId(it?.toolId)
    if (!toolId || seen.has(toolId)) continue
    seen.add(toolId)
    const label = typeof it.label === 'string' && it.label.trim() ? it.label.trim() : TOOL_LABEL[toolId]
    items.push({ toolId, label })
  }
  return { id, name, items, appearance: normalizeAppearance(s.appearance) }
}

function normLock(l: Partial<ToolLock>): ToolLock | null {
  const toolId = asToolId(l.toolId)
  if (!toolId) return null
  const interventions = (Array.isArray(l.interventions) ? l.interventions : []).filter(
    (x): x is InterventionKind => x === 'breath' || x === 'outside' || x === 'reps' || x === 'pause',
  )
  return {
    toolId,
    enabled: l.enabled !== false,
    interventions: interventions.length ? interventions : ['pause'],
    bypassAllowed: Boolean(l.bypassAllowed),
    days: Array.isArray(l.days) ? l.days.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6) : [],
    startMin: clampMin(l.startMin, 0),
    endMin: clampMin(l.endMin, 24 * 60),
    profileIds: Array.isArray(l.profileIds) ? l.profileIds.filter((x) => typeof x === 'string') : [],
  }
}

function normProfile(p: Partial<FocusProfile>, spaceIds: Set<string>): FocusProfile {
  const spaceId = typeof p.spaceId === 'string' && spaceIds.has(p.spaceId) ? p.spaceId : [...spaceIds][0] ?? 'work'
  return {
    id: typeof p.id === 'string' && p.id.trim() ? p.id : uid(),
    name: typeof p.name === 'string' && p.name.trim() ? p.name.trim() : 'Profile',
    spaceId,
    extraLockToolIds: (Array.isArray(p.extraLockToolIds) ? p.extraLockToolIds : []).filter(isToolId),
    days: Array.isArray(p.days) ? p.days.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6) : [],
    startMin: clampMin(p.startMin, 0),
    endMin: clampMin(p.endMin, 24 * 60),
    enabled: Boolean(p.enabled),
  }
}

function normDetox(d: Partial<DetoxConfig> | null | undefined): DetoxConfig {
  return {
    active: Boolean(d?.active),
    until: typeof d?.until === 'string' ? d.until : undefined,
    whitelist: (Array.isArray(d?.whitelist) ? d.whitelist : ['today', 'journal']).filter(isToolId),
    startedAt: typeof d?.startedAt === 'string' ? d.startedAt : undefined,
  }
}

function normVisit(v: Partial<AttentionVisit>): AttentionVisit | null {
  const toolId = asToolId(v.toolId)
  if (!toolId || typeof v.startedAt !== 'string') return null
  return {
    id: typeof v.id === 'string' ? v.id : uid(),
    toolId,
    startedAt: v.startedAt,
    endedAt: typeof v.endedAt === 'string' ? v.endedAt : undefined,
    essential: Boolean(v.essential),
    locked: Boolean(v.locked),
    bypassed: Boolean(v.bypassed),
  }
}

function normBypass(b: Partial<BypassLog>): BypassLog | null {
  const toolId = asToolId(b.toolId)
  if (!toolId || typeof b.at !== 'string') return null
  return { id: typeof b.id === 'string' ? b.id : uid(), toolId, at: b.at }
}

export function trimVisits(visits: AttentionVisit[], now = Date.now()) {
  const cutoff = now - 21 * 24 * 60 * 60 * 1000
  return visits.filter((v) => Date.parse(v.startedAt) >= cutoff).slice(0, 400)
}

export function minutesNow(d: Date) {
  return d.getHours() * 60 + d.getMinutes()
}

/** Inclusive start, exclusive end. Equal start/end means the whole day. Overnight windows wrap. */
export function inWindow(nowMin: number, start: number, end: number) {
  if (start === end) return true
  if (start < end) return nowMin >= start && nowMin < end
  return nowMin >= start || nowMin < end
}

export function localMidnightISO(from = new Date()) {
  const d = new Date(from)
  d.setHours(24, 0, 0, 0)
  return d.toISOString()
}

export function detoxActive(detox: DetoxConfig, now = new Date()) {
  if (!detox.active) return false
  if (!detox.until) return true
  const t = Date.parse(detox.until)
  if (!Number.isFinite(t)) return true
  return t > now.getTime()
}

export function scheduledProfile(profiles: FocusProfile[], now = new Date()) {
  const day = now.getDay()
  const min = minutesNow(now)
  return profiles.find((p) => p.enabled && (p.days.length === 0 || p.days.includes(day)) && inWindow(min, p.startMin, p.endMin))
}

export function activeProfile(attention: Attention, now = new Date()) {
  if (attention.activeProfileId) {
    const manual = attention.profiles.find((p) => p.id === attention.activeProfileId)
    if (manual) return manual
  }
  return scheduledProfile(attention.profiles, now)
}

export function effectiveSpace(attention: Attention, now = new Date()) {
  const profile = activeProfile(attention, now)
  const id = profile?.spaceId ?? attention.activeSpaceId
  return attention.spaces.find((s) => s.id === id) ?? attention.spaces[0] ?? defaultSpaces()[0]
}

export function libraryItems(space: AttentionSpace): SpaceItem[] {
  const shown = new Set(space.items.map((i) => i.toolId))
  return TOOL_IDS.filter((id) => !shown.has(id)).map((toolId) => ({ toolId, label: TOOL_LABEL[toolId] }))
}

export type GateReason = 'open' | 'detox' | 'lock' | 'profile'

export interface GateDecision {
  blocked: boolean
  reason: GateReason
  interventions: InterventionKind[]
  bypassAllowed: boolean
  message: string
  lock?: ToolLock
}

export function evaluateGate(attention: Attention, toolId: ToolId | 'home', now = new Date()): GateDecision {
  if (toolId === 'home' || toolId === 'settings') {
    return { blocked: false, reason: 'open', interventions: [], bypassAllowed: false, message: '' }
  }
  const open: GateDecision = { blocked: false, reason: 'open', interventions: [], bypassAllowed: false, message: '' }
  if (detoxActive(attention.detox, now) && !attention.detox.whitelist.includes(toolId)) {
    return {
      blocked: true,
      reason: 'detox',
      interventions: [],
      bypassAllowed: false,
      message: 'Quiet hours. This tool waits until detox ends.',
    }
  }
  const profile = activeProfile(attention, now)
  const lock = attention.locks.find((l) => l.toolId === toolId && l.enabled)
  const day = now.getDay()
  const min = minutesNow(now)
  if (profile && profile.extraLockToolIds.includes(toolId)) {
    return {
      blocked: true,
      reason: 'profile',
      interventions: lock?.interventions?.length ? lock.interventions : ['pause'],
      bypassAllowed: Boolean(lock?.bypassAllowed),
      message: `${profile.name} has this tool paused.`,
      lock,
    }
  }
  if (!lock) return open
  if (lock.days.length && !lock.days.includes(day)) return open
  if (!inWindow(min, lock.startMin, lock.endMin)) return open
  if (lock.profileIds.length) {
    if (!profile || !lock.profileIds.includes(profile.id)) return open
  }
  return {
    blocked: true,
    reason: 'lock',
    interventions: lock.interventions.length ? lock.interventions : ['pause'],
    bypassAllowed: lock.bypassAllowed,
    message: 'A pause sits between you and this tool.',
    lock,
  }
}

export function visibleHomeItems(attention: Attention, now = new Date()): SpaceItem[] {
  const space = effectiveSpace(attention, now)
  if (detoxActive(attention.detox, now)) {
    const allow = new Set(attention.detox.whitelist)
    return space.items.filter((i) => allow.has(i.toolId))
  }
  return space.items
}

export function isEssential(attention: Attention, toolId: ToolId, now = new Date()) {
  return effectiveSpace(attention, now).items.some((i) => i.toolId === toolId)
}

export function startDetox(attention: Attention, until: string | undefined, now = new Date()): Attention {
  return {
    ...attention,
    detox: {
      ...attention.detox,
      active: true,
      until,
      startedAt: now.toISOString(),
    },
  }
}

export function endDetox(attention: Attention): Attention {
  return { ...attention, detox: { ...attention.detox, active: false, until: undefined, startedAt: undefined } }
}

export function recordVisit(
  attention: Attention,
  toolId: ToolId,
  now = new Date(),
  extra?: { locked?: boolean; bypassed?: boolean },
): Attention {
  const visits = attention.visits.map((v) => (v.endedAt ? v : { ...v, endedAt: now.toISOString() }))
  visits.unshift({
    id: uid(),
    toolId,
    startedAt: now.toISOString(),
    essential: isEssential(attention, toolId, now),
    locked: Boolean(extra?.locked),
    bypassed: Boolean(extra?.bypassed),
  })
  return { ...attention, visits: trimVisits(visits, now.getTime()) }
}

export function closeOpenVisit(attention: Attention, now = new Date()): Attention {
  if (!attention.visits.some((v) => !v.endedAt)) return attention
  return {
    ...attention,
    visits: attention.visits.map((v) => (v.endedAt ? v : { ...v, endedAt: now.toISOString() })),
  }
}

export function recordBypass(attention: Attention, toolId: ToolId, now = new Date()): Attention {
  return {
    ...attention,
    bypasses: [{ id: uid(), toolId, at: now.toISOString() }, ...attention.bypasses].slice(0, 200),
  }
}

function dayKey(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function markQuietDay(attention: Attention, day = todayISO()): Attention {
  const usedLocked = attention.visits.some((v) => dayKey(v.startedAt) === day && (v.locked || v.bypassed))
  if (usedLocked) return { ...attention, quietDays: attention.quietDays.filter((d) => d !== day) }
  if (attention.quietDays.includes(day)) return attention
  return { ...attention, quietDays: [...attention.quietDays, day].sort() }
}

function usedLockedOn(attention: Attention, day: string) {
  return attention.visits.some((v) => dayKey(v.startedAt) === day && (v.locked || v.bypassed))
}

export function quietStreak(attention: Attention, today = todayISO()) {
  if (usedLockedOn(attention, today)) return 0
  const set = new Set(attention.quietDays)
  let cursor = today
  let n = 0
  while (true) {
    const locked = usedLockedOn(attention, cursor)
    const marked = set.has(cursor)
    if (locked) break
    if (!marked && cursor !== today) break
    n += 1
    cursor = shiftDay(cursor, -1)
    if (n > 400) break
  }
  return n
}

function shiftDay(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, (m ?? 1) - 1, (d ?? 1) + days)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

export function detoxStreak(attention: Attention, today = todayISO()) {
  const days = new Set<string>()
  if (attention.detox.startedAt) days.add(dayKey(attention.detox.startedAt))
  if (detoxActive(attention.detox)) days.add(today)
  let cursor = today
  let n = 0
  while (days.has(cursor)) {
    n += 1
    cursor = shiftDay(cursor, -1)
    if (n > 400) break
  }
  return n
}

export function quietBadge(streak: number) {
  if (streak >= 30) return 'A month of room'
  if (streak >= 7) return 'A week of absence'
  if (streak >= 3) return 'Still'
  if (streak >= 1) return 'Quiet morning'
  return ''
}

export interface AttentionTotals {
  essentialMin: number
  otherMin: number
  lockedOpens: number
  bypasses: number
}

function visitMinutes(v: AttentionVisit, now: number) {
  const start = Date.parse(v.startedAt)
  if (!Number.isFinite(start)) return 0
  const end = v.endedAt ? Date.parse(v.endedAt) : now
  if (!Number.isFinite(end) || end <= start) return 0
  return Math.min(4 * 60, (end - start) / 60000)
}

export function attentionRange(attention: Attention, fromISO: string, toISO: string, now = Date.now()): AttentionTotals {
  let essentialMin = 0
  let otherMin = 0
  let lockedOpens = 0
  for (const v of attention.visits) {
    const day = dayKey(v.startedAt)
    if (day < fromISO || day > toISO) continue
    const m = visitMinutes(v, now)
    if (v.essential) essentialMin += m
    else otherMin += m
    if (v.locked || v.bypassed) lockedOpens += 1
  }
  const bypasses = attention.bypasses.filter((b) => {
    const day = dayKey(b.at)
    return day >= fromISO && day <= toISO
  }).length
  return {
    essentialMin: Math.round(essentialMin),
    otherMin: Math.round(otherMin),
    lockedOpens,
    bypasses,
  }
}

export function mergeAttention(local: Attention | undefined, remote: Attention | undefined, preferLocal: boolean): Attention {
  const left = normalizeAttention(local)
  const right = normalizeAttention(remote)
  const base = preferLocal ? left : right
  const other = preferLocal ? right : left
  const spaceMap = new Map<string, AttentionSpace>()
  for (const s of other.spaces) spaceMap.set(s.id, s)
  for (const s of base.spaces) spaceMap.set(s.id, s)
  const lockMap = new Map<string, ToolLock>()
  for (const l of other.locks) lockMap.set(l.toolId, l)
  for (const l of base.locks) lockMap.set(l.toolId, l)
  const profileMap = new Map<string, FocusProfile>()
  for (const p of other.profiles) profileMap.set(p.id, p)
  for (const p of base.profiles) profileMap.set(p.id, p)
  const visitMap = new Map<string, AttentionVisit>()
  for (const v of other.visits) visitMap.set(v.id, v)
  for (const v of base.visits) visitMap.set(v.id, v)
  const bypassMap = new Map<string, BypassLog>()
  for (const b of other.bypasses) bypassMap.set(b.id, b)
  for (const b of base.bypasses) bypassMap.set(b.id, b)
  return normalizeAttention({
    ...other,
    ...base,
    onboarded: left.onboarded || right.onboarded,
    spaces: [...spaceMap.values()],
    locks: [...lockMap.values()],
    profiles: [...profileMap.values()],
    visits: [...visitMap.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    bypasses: [...bypassMap.values()].sort((a, b) => b.at.localeCompare(a.at)),
    quietDays: [...new Set([...left.quietDays, ...right.quietDays])].sort(),
    detox: base.detox.active || !other.detox.active ? base.detox : other.detox,
  })
}

export function fmtClock(d = new Date()) {
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function fmtDate(d = new Date()) {
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}

export function fmtHM(min: number) {
  const h = Math.floor(min / 60) % 24
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function parseHM(value: string) {
  const [h, m] = value.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0
  return clampMin(h * 60 + m, 0)
}

const WEATHER_KEY = 'sepho.weather'

export interface WeatherSnap {
  label: string
  at: number
}

export function readWeather(): WeatherSnap | null {
  try {
    const raw = localStorage.getItem(WEATHER_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as WeatherSnap
    if (!p?.label || Date.now() - p.at > 45 * 60 * 1000) return null
    return p
  } catch {
    return null
  }
}

function weatherWord(code: number) {
  if (code === 0) return 'Clear'
  if (code <= 3) return 'Clouds'
  if (code <= 48) return 'Fog'
  if (code <= 67) return 'Rain'
  if (code <= 77) return 'Snow'
  if (code <= 82) return 'Showers'
  if (code <= 99) return 'Storm'
  return 'Outside'
}

export async function fetchWeather(): Promise<WeatherSnap | null> {
  const cached = readWeather()
  if (cached) return cached
  if (!navigator.geolocation) return null
  const pos = await new Promise<GeolocationPosition | null>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(p),
      () => resolve(null),
      { maximumAge: 3_600_000, timeout: 8000 },
    )
  })
  if (!pos) return null
  const { latitude, longitude } = pos.coords
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = (await res.json()) as { current?: { temperature_2m?: number; weather_code?: number } }
  const t = data.current?.temperature_2m
  const code = data.current?.weather_code ?? 0
  if (typeof t !== 'number') return null
  const snap: WeatherSnap = { label: `${Math.round(t)}° ${weatherWord(code)}`, at: Date.now() }
  try {
    localStorage.setItem(WEATHER_KEY, JSON.stringify(snap))
  } catch {
    /* quota */
  }
  return snap
}
