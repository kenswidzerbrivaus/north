import { useEffect, useMemo, useState } from 'react'
import {
  activeProfile,
  detoxActive,
  detoxStreak,
  effectiveSpace,
  fetchWeather,
  fmtClock,
  fmtDate,
  localMidnightISO,
  quietBadge,
  quietStreak,
  startDetox,
  TOOL_IDS,
  TOOL_LABEL,
  visibleHomeItems,
  type WeatherSnap,
} from '../lib/attention'
import { useStore } from '../store'
import type { Route, ToolId } from '../lib/types'

export function BlankHome({
  go,
  onSearch,
  onOpenTool,
}: {
  go: (r: Route) => void
  onSearch: () => void
  onOpenTool: (id: ToolId) => void
}) {
  const { state, updateAttention } = useStore()
  const a = state.attention
  const [now, setNow] = useState(() => new Date())
  const [library, setLibrary] = useState(false)
  const [editing, setEditing] = useState(false)
  const [detoxOpen, setDetoxOpen] = useState(false)
  const [weather, setWeather] = useState<WeatherSnap | null>(null)

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    if (!a.showWeather) return
    void fetchWeather().then((w) => {
      if (w) setWeather(w)
    })
  }, [a.showWeather])

  const space = useMemo(() => effectiveSpace(a, now), [a, now])
  const items = useMemo(() => visibleHomeItems(a, now), [a, now])
  const hidden = useMemo(() => {
    const shown = new Set(items.map((i) => i.toolId))
    return TOOL_IDS.filter((id) => !shown.has(id)).map((toolId) => ({ toolId, label: TOOL_LABEL[toolId] }))
  }, [items])
  const profile = useMemo(() => activeProfile(a, now), [a, now])
  const detox = detoxActive(a.detox, now)
  const look = space.appearance
  const streak = quietStreak(a)
  const dStreak = detoxStreak(a)
  const badge = quietBadge(streak)
  const phone = state.settings.phoneNumber.trim()

  const setSpace = (id: string) => updateAttention({ activeSpaceId: id })

  const rename = (toolId: ToolId, label: string) => {
    updateAttention((cur) => ({
      ...cur,
      spaces: cur.spaces.map((s) =>
        s.id === space.id
          ? { ...s, items: s.items.map((it) => (it.toolId === toolId ? { ...it, label: label.trim() || TOOL_LABEL[toolId] } : it)) }
          : s,
      ),
    }))
  }

  const move = (toolId: ToolId, dir: -1 | 1) => {
    updateAttention((cur) => ({
      ...cur,
      spaces: cur.spaces.map((s) => {
        if (s.id !== space.id) return s
        const i = s.items.findIndex((it) => it.toolId === toolId)
        const j = i + dir
        if (i < 0 || j < 0 || j >= s.items.length) return s
        const next = s.items.slice()
        const [row] = next.splice(i, 1)
        if (row) next.splice(j, 0, row)
        return { ...s, items: next }
      }),
    }))
  }

  const hide = (toolId: ToolId) => {
    updateAttention((cur) => ({
      ...cur,
      spaces: cur.spaces.map((s) => (s.id === space.id ? { ...s, items: s.items.filter((it) => it.toolId !== toolId) } : s)),
    }))
  }

  const add = (toolId: ToolId) => {
    updateAttention((cur) => ({
      ...cur,
      spaces: cur.spaces.map((s) =>
        s.id === space.id && !s.items.some((it) => it.toolId === toolId)
          ? { ...s, items: [...s.items, { toolId, label: TOOL_LABEL[toolId] }] }
          : s,
      ),
    }))
  }

  const beginDetox = (kind: 'noon' | 'day' | 'twoh') => {
    const end = new Date(now)
    if (kind === 'noon') {
      end.setHours(12, 0, 0, 0)
      if (end.getTime() <= now.getTime()) end.setDate(end.getDate() + 1)
    } else if (kind === 'twoh') {
      end.setTime(now.getTime() + 2 * 60 * 60 * 1000)
    } else {
      return updateAttention((cur) => startDetox(cur, localMidnightISO(now), now))
    }
    updateAttention((cur) => startDetox(cur, end.toISOString(), now))
    setDetoxOpen(false)
  }

  const gap =
    look.spacing === 'tight' ? '2px' : look.spacing === 'loose' ? '14px' : '6px'
  const font =
    look.font === 'serif' ? 'Georgia, "Iowan Old Style", serif' : look.font === 'mono' ? 'ui-monospace, Menlo, monospace' : undefined

  return (
    <div
      className={`blank-space is-${look.wallpaper}${look.mono ? ' is-mono' : ''}${look.align === 'left' ? ' is-left' : ''}`}
      style={{
        fontFamily: font,
        ['--blank-size' as string]: `${look.textSize}px`,
        ['--blank-gap' as string]: gap,
      }}
    >
      <header className="blank-space-top">
        {a.showTime ? <p className="blank-space-time">{fmtClock(now)}</p> : null}
        <p className="blank-space-date">{fmtDate(now)}</p>
        {a.showWeather && weather ? <p className="blank-space-weather">{weather.label}</p> : null}
        <p className="blank-space-space">{space.name}</p>
        {profile ? <p className="blank-space-meta">{profile.name}</p> : null}
        {detox ? <p className="blank-space-meta">Detox</p> : null}
        {badge ? <p className="blank-space-meta">{badge}</p> : null}
      </header>

      <nav className="blank-space-links" aria-label={space.name}>
        {detox ? (
          <>
            {phone ? (
              <a className="blank-space-link" href={`tel:${phone.replace(/[^\d+]/g, '')}`}>
                Call
              </a>
            ) : null}
            {phone ? (
              <a className="blank-space-link" href={`sms:${phone.replace(/[^\d+]/g, '')}`}>
                Messages
              </a>
            ) : (
              <p className="blank-space-meta">Add a number in Settings for Call and Messages.</p>
            )}
          </>
        ) : null}
        {items.map((it) =>
          editing ? (
            <div key={it.toolId} className="blank-edit-row">
              <input
                className="blank-edit-input"
                value={it.label}
                onChange={(e) => rename(it.toolId, e.target.value)}
                aria-label={`Label for ${TOOL_LABEL[it.toolId]}`}
              />
              <button type="button" onClick={() => move(it.toolId, -1)} aria-label="Move up">
                ↑
              </button>
              <button type="button" onClick={() => move(it.toolId, 1)} aria-label="Move down">
                ↓
              </button>
              <button type="button" onClick={() => hide(it.toolId)}>
                Hide
              </button>
            </div>
          ) : (
            <button key={it.toolId} type="button" onClick={() => onOpenTool(it.toolId)}>
              {it.label}
            </button>
          ),
        )}
      </nav>

      <footer className="blank-space-foot">
        {streak > 0 || dStreak > 0 ? (
          <p className="blank-space-meta">
            {streak > 0 ? `${streak} quiet day${streak === 1 ? '' : 's'}` : ''}
            {streak > 0 && dStreak > 0 ? ' · ' : ''}
            {dStreak > 0 ? `${dStreak} detox` : ''}
          </p>
        ) : null}
        <div className="blank-space-actions">
          <button type="button" className="blank-space-search" onClick={onSearch}>
            Search
          </button>
          <button type="button" className="blank-space-search" onClick={() => setLibrary((v) => !v)}>
            Library
          </button>
          <button type="button" className="blank-space-search" onClick={() => setEditing((v) => !v)}>
            {editing ? 'Done' : 'Edit'}
          </button>
          <button
            type="button"
            className="blank-space-search"
            onClick={() => (detox ? updateAttention((cur) => ({ ...cur, detox: { ...cur.detox, active: false, until: undefined } })) : setDetoxOpen((v) => !v))}
          >
            {detox ? 'End detox' : 'Detox'}
          </button>
          <button type="button" className="blank-space-search" onClick={() => go('settings')}>
            Setup
          </button>
        </div>
        {a.spaces.length > 1 ? (
          <div className="blank-space-spaces">
            {a.spaces.map((s) => (
              <button key={s.id} type="button" data-on={s.id === space.id} onClick={() => setSpace(s.id)}>
                {s.name}
              </button>
            ))}
          </div>
        ) : null}
      </footer>

      {detoxOpen ? (
        <div className="blank-sheet" role="dialog" aria-label="Detox">
          <p className="lock-kicker">Detox</p>
          <p className="lock-copy">Strip the list to calls, messages, and your whitelist.</p>
          <button type="button" className="lock-go" onClick={() => beginDetox('noon')}>
            Until noon
          </button>
          <button type="button" className="lock-go" onClick={() => beginDetox('twoh')}>
            Two hours
          </button>
          <button type="button" className="lock-go" onClick={() => beginDetox('day')}>
            Rest of day
          </button>
          <button type="button" className="lock-skip" onClick={() => setDetoxOpen(false)}>
            Cancel
          </button>
        </div>
      ) : null}

      {library ? (
        <div className="blank-sheet" role="dialog" aria-label="Library">
          <p className="lock-kicker">Library</p>
          <p className="lock-copy">Hidden from this space. Still here.</p>
          {(editing ? TOOL_IDS.filter((id) => !space.items.some((it) => it.toolId === id)) : hidden.map((h) => h.toolId)).map(
            (id) => (
              <div key={id} className="blank-lib-row">
                <button
                  type="button"
                  onClick={() => {
                    setLibrary(false)
                    onOpenTool(id)
                  }}
                >
                  {TOOL_LABEL[id]}
                </button>
                {editing ? (
                  <button type="button" onClick={() => add(id)}>
                    Add
                  </button>
                ) : null}
              </div>
            ),
          )}
          {!hidden.length && !editing ? <p className="lock-copy">Every tool is on this list.</p> : null}
          <button type="button" className="lock-skip" onClick={() => setLibrary(false)}>
            Close
          </button>
        </div>
      ) : null}
    </div>
  )
}
