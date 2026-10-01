import { systemApp } from './system-apps'
import type { SpaceItem, SystemAppId } from './types'

export type NativePlatform = 'ios' | 'android' | 'web'

type NativeHost = {
  invoke: (method: string, payload?: unknown) => Promise<unknown>
}

declare global {
  interface Window {
    SephoNative?: NativeHost
    webkit?: { messageHandlers?: { sepho?: { postMessage: (msg: unknown) => void } } }
    __sephoNativeCb?: Record<string, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>
  }
}

type AndroidBridge = { invoke: (method: string, payload: string) => string }

function androidHost(): NativeHost | null {
  const bridge = (window as unknown as { SephoAndroid?: AndroidBridge }).SephoAndroid
  if (!bridge?.invoke) return null
  return {
    invoke(method, payload) {
      try {
        const raw = bridge.invoke(method, JSON.stringify(payload ?? {}))
        return Promise.resolve(JSON.parse(raw) as unknown)
      } catch (err) {
        return Promise.reject(err)
      }
    },
  }
}

function wkHost(): NativeHost | null {
  const handler = window.webkit?.messageHandlers?.sepho
  if (!handler) return null
  if (!window.__sephoNativeCb) window.__sephoNativeCb = {}
  return {
    invoke(method, payload) {
      return new Promise((resolve, reject) => {
        const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
        window.__sephoNativeCb![id] = { resolve, reject }
        handler.postMessage({ id, method, payload: payload ?? null })
      })
    },
  }
}

export function nativeHost(): NativeHost | null {
  if (typeof window === 'undefined') return null
  return window.SephoNative ?? wkHost() ?? androidHost()
}

export function nativePlatform(): NativePlatform {
  if (nativeHost()) {
    if (/Android/i.test(navigator.userAgent)) return 'android'
    return 'ios'
  }
  return 'web'
}

export function nativeAvailable() {
  return nativePlatform() !== 'web'
}

export async function nativeInvoke<T>(method: string, payload?: unknown): Promise<T | null> {
  const host = nativeHost()
  if (!host) return null
  try {
    return (await host.invoke(method, payload)) as T
  } catch {
    return null
  }
}

export async function authorizeScreenTime() {
  return nativeInvoke<{ ok: boolean; authorized?: boolean }>('authorizeScreenTime')
}

export async function pickLockedApps() {
  return nativeInvoke<{ ok: boolean; selection?: string; count?: number }>('pickLockedApps')
}

export async function applyAppShields(opts: { selection?: string; detox?: boolean }) {
  return nativeInvoke<{ ok: boolean }>('applyAppShields', opts)
}

export async function clearAppShields() {
  return nativeInvoke<{ ok: boolean }>('clearAppShields')
}

export async function unshieldForUnlock(seconds = 20 * 60) {
  return nativeInvoke<{ ok: boolean }>('unshieldTemporarily', { seconds })
}

export async function nativeUsage() {
  return nativeInvoke<{ essentialMin: number; otherMin: number }>('usageStats')
}

export async function syncLauncherToDevice(items: { label: string; scheme?: string; tool?: string }[]) {
  return nativeInvoke<{ ok: boolean }>('syncLauncher', { items })
}

export async function setAsAndroidLauncher() {
  return nativeInvoke<{ ok: boolean }>('requestLauncher')
}

/** Open Phone.app, Messages.app, Safari, etc. Native path uses UIApplication / Android intents. */
export async function openSystemApp(id: SystemAppId) {
  const app = systemApp(id)
  const native = await nativeInvoke<{ ok: boolean }>('openURL', { url: app.scheme, id })
  if (native?.ok) return true
  try {
    window.location.href = app.scheme
    return true
  } catch {
    return false
  }
}

export function launcherPayload(items: SpaceItem[]) {
  return items.map((it) => {
    if (it.kind === 'system' && it.systemId) {
      const app = systemApp(it.systemId)
      return { label: it.label || app.label, scheme: app.scheme, id: app.id, kind: 'system' as const }
    }
    return { label: it.label, tool: it.toolId, kind: 'tool' as const, scheme: `https://kenswidzerbrivaus.com/#/${it.toolId}` }
  })
}
