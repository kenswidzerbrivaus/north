import type { SystemAppId } from './types'

export interface SystemApp {
  id: SystemAppId
  label: string
  /** Opens the real system app (Phone.app, Messages.app, Safari, …). */
  scheme: string
}

export const SYSTEM_APPS: SystemApp[] = [
  { id: 'phone', label: 'Phone', scheme: 'tel://' },
  { id: 'messages', label: 'Messages', scheme: 'sms://' },
  { id: 'safari', label: 'Safari', scheme: 'x-web-search://' },
  { id: 'mail', label: 'Mail', scheme: 'mailto:' },
  { id: 'camera', label: 'Camera', scheme: 'camera://' },
  { id: 'photos', label: 'Photos', scheme: 'photos-redirect://' },
  { id: 'maps', label: 'Maps', scheme: 'maps://' },
  { id: 'music', label: 'Music', scheme: 'music://' },
  { id: 'calendar-app', label: 'Calendar app', scheme: 'calshow://' },
]

export const SYSTEM_APP_IDS = SYSTEM_APPS.map((a) => a.id)

export const SYSTEM_LABEL: Record<SystemAppId, string> = Object.fromEntries(SYSTEM_APPS.map((a) => [a.id, a.label])) as Record<
  SystemAppId,
  string
>

export function isSystemAppId(id: string): id is SystemAppId {
  return (SYSTEM_APP_IDS as string[]).includes(id)
}

export function systemApp(id: SystemAppId) {
  return SYSTEM_APPS.find((a) => a.id === id) ?? SYSTEM_APPS[0]
}
