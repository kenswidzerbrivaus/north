import type { State } from './types'

/** App name leftovers from the North → Sepho rename. Does not touch “North star”. */
export function sephoCopy(text: string): string {
  return text
    .replace(/\bWelcome to North\b/g, 'Welcome to Sepho')
    .replace(/\bWalk through North\b/g, 'Walk through Sepho')
}

function swap(value: string) {
  return value.includes('North') ? sephoCopy(value) : value
}

export function rebrandState(state: State): State {
  return {
    ...state,
    tasks: state.tasks.map((t) => ({ ...t, title: swap(t.title), notes: swap(t.notes) })),
    notes: state.notes.map((n) => ({ ...n, title: swap(n.title), body: swap(n.body) })),
    events: state.events.map((e) => ({ ...e, title: swap(e.title), notes: swap(e.notes) })),
  }
}
