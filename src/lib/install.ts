export const INSTALL_ORIGIN = 'https://kenswidzerbrivaus.com/'

export const INSTALL_URL = INSTALL_ORIGIN

export function installUrlWithClient(clientId?: string) {
  const id = clientId?.trim()
  if (!id) return INSTALL_ORIGIN
  return `${INSTALL_ORIGIN}#/settings?gcid=${encodeURIComponent(id)}`
}

export function isStandaloneApp() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  )
}

export function isIosDevice() {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}
