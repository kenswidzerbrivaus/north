import { useEffect, useState } from 'react'
import { ROUTES, type Route } from './types'

const ids = ROUTES.map((r) => r.id)

function parse(): Route {
  const h = location.hash.replace(/^#\/?/, '')
  const base = (h.split(/[/?]/)[0] || 'today') as Route
  return ids.includes(base) ? base : 'today'
}

export function projectIdFromHash() {
  const m = location.hash.match(/#\/projects\/([^/?#]+)/)
  return m?.[1] ? decodeURIComponent(m[1]) : null
}

export function hashParam(name: string) {
  const i = location.hash.indexOf('?')
  if (i < 0) return null
  return new URLSearchParams(location.hash.slice(i + 1)).get(name)
}

export function useRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(parse)

  useEffect(() => {
    if (!location.hash) location.hash = '#/today'
    const on = () => setRoute(parse())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  const go = (r: Route) => {
    if (location.hash !== `#/${r}`) location.hash = `#/${r}`
    setRoute(r)
  }

  return [route, go]
}

export function isTypingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false
  return Boolean(el.closest('input, textarea, select, [contenteditable="true"]'))
}
