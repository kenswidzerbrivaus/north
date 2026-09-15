import { useEffect, useState } from 'react'
import { ROUTES, type Route } from './types'

const ids = ROUTES.map((r) => r.id)

function parse(): Route {
  const h = location.hash.replace(/^#\/?/, '')
  return ids.includes(h as Route) ? (h as Route) : 'today'
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
