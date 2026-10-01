import { Field } from '../components/ui'
import {
  INTERVENTION_LABEL,
  TOOL_IDS,
  TOOL_LABEL,
  WALLPAPERS,
  fmtHM,
  itemKey,
  parseHM,
} from '../lib/attention'
import { SYSTEM_APPS } from '../lib/system-apps'
import { uid } from '../lib/id'
import { useStore } from '../store'
import type { AttentionSpace, FocusProfile, InterventionKind, ToolId, ToolLock } from '../lib/types'

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function DayToggles({ value, onChange }: { value: number[]; onChange: (d: number[]) => void }) {
  return (
    <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
      {DAYS.map((label, i) => (
        <button
          key={i}
          type="button"
          className="chip"
          data-on={value.length === 0 || value.includes(i)}
          onClick={() => {
            if (value.length === 0) onChange([i])
            else if (value.includes(i)) {
              const next = value.filter((d) => d !== i)
              onChange(next)
            } else onChange([...value, i].sort())
          }}
        >
          {label}
        </button>
      ))}
      <button type="button" className="chip" data-on={value.length === 0} onClick={() => onChange([])}>
        Every day
      </button>
    </div>
  )
}

export function AttentionSettings() {
  const { state, updateAttention } = useStore()
  const a = state.attention
  const space = a.spaces.find((s) => s.id === a.activeSpaceId) ?? a.spaces[0]

  const patchSpace = (id: string, patch: Partial<AttentionSpace>) =>
    updateAttention((cur) => ({
      ...cur,
      spaces: cur.spaces.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }))

  const patchLock = (toolId: ToolId, patch: Partial<ToolLock>) =>
    updateAttention((cur) => {
      const existing = cur.locks.find((l) => l.toolId === toolId)
      const base: ToolLock = existing ?? {
        toolId,
        enabled: true,
        interventions: ['pause'],
        bypassAllowed: false,
        days: [],
        startMin: 0,
        endMin: 24 * 60,
        profileIds: [],
      }
      const next = { ...base, ...patch, toolId }
      const rest = cur.locks.filter((l) => l.toolId !== toolId)
      return { ...cur, locks: next.enabled || existing ? [...rest, next] : rest }
    })

  return (
    <>
      <section className="card stack">
        <h2>Appearance</h2>
        <p className="muted">These dress the quiet home. The desk chrome stays as it is.</p>
        <Field label="Font">
          <select
            className="select"
            value={a.appearance.font}
            onChange={(e) =>
              updateAttention((cur) => ({
                ...cur,
                appearance: { ...cur.appearance, font: e.target.value as typeof cur.appearance.font },
                spaces: cur.spaces.map((s) =>
                  s.id === space?.id ? { ...s, appearance: { ...s.appearance, font: e.target.value as typeof s.appearance.font } } : s,
                ),
              }))
            }
          >
            <option value="system">System</option>
            <option value="serif">Serif</option>
            <option value="mono">Mono</option>
          </select>
        </Field>
        <Field label="Text size">
          <input
            className="input"
            type="number"
            min={16}
            max={40}
            value={space?.appearance.textSize ?? a.appearance.textSize}
            onChange={(e) => space && patchSpace(space.id, { appearance: { ...space.appearance, textSize: Number(e.target.value) || 28 } })}
          />
        </Field>
        <Field label="Alignment">
          <select
            className="select"
            value={space?.appearance.align ?? 'center'}
            onChange={(e) => space && patchSpace(space.id, { appearance: { ...space.appearance, align: e.target.value === 'left' ? 'left' : 'center' } })}
          >
            <option value="center">Center</option>
            <option value="left">Left</option>
          </select>
        </Field>
        <Field label="Spacing">
          <select
            className="select"
            value={space?.appearance.spacing ?? 'regular'}
            onChange={(e) =>
              space &&
              patchSpace(space.id, {
                appearance: {
                  ...space.appearance,
                  spacing: e.target.value === 'tight' || e.target.value === 'loose' ? e.target.value : 'regular',
                },
              })
            }
          >
            <option value="tight">Tight</option>
            <option value="regular">Regular</option>
            <option value="loose">Loose</option>
          </select>
        </Field>
        <Field label="Wallpaper">
          <select
            className="select"
            value={space?.appearance.wallpaper ?? 'dusk'}
            onChange={(e) =>
              space && patchSpace(space.id, { appearance: { ...space.appearance, wallpaper: e.target.value as typeof space.appearance.wallpaper } })
            }
          >
            {WALLPAPERS.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </select>
        </Field>
        <label className="row">
          <input
            type="checkbox"
            checked={Boolean(space?.appearance.mono)}
            onChange={(e) => space && patchSpace(space.id, { appearance: { ...space.appearance, mono: e.target.checked } })}
          />
          Monochrome
        </label>
        <label className="row">
          <input type="checkbox" checked={a.showTime} onChange={(e) => updateAttention({ showTime: e.target.checked })} />
          Show time on home
        </label>
        <label className="row">
          <input type="checkbox" checked={a.showWeather} onChange={(e) => updateAttention({ showWeather: e.target.checked })} />
          Show weather on home (this device’s location + Open-Meteo)
        </label>
      </section>

      <section className="card stack">
        <h2>Spaces</h2>
        <p className="muted">Named rooms with different tools. Hidden tools live in Library.</p>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {a.spaces.map((s) => (
            <button key={s.id} type="button" className="chip" data-on={s.id === a.activeSpaceId} onClick={() => updateAttention({ activeSpaceId: s.id })}>
              {s.name}
            </button>
          ))}
        </div>
        {space ? (
          <>
            <Field label="Name">
              <input className="input" value={space.name} onChange={(e) => patchSpace(space.id, { name: e.target.value })} />
            </Field>
            <p className="kicker">Essentials on this home</p>
            {space.items.map((it, i) => (
              <div key={itemKey(it)} className="row" style={{ alignItems: 'center' }}>
                <input
                  className="input"
                  value={it.label}
                  onChange={(e) =>
                    patchSpace(space.id, {
                      items: space.items.map((row) => (itemKey(row) === itemKey(it) ? { ...row, label: e.target.value } : row)),
                    })
                  }
                />
                <button type="button" className="btn-ghost" disabled={i === 0} onClick={() => {
                  const next = space.items.slice()
                  const [row] = next.splice(i, 1)
                  if (row) next.splice(i - 1, 0, row)
                  patchSpace(space.id, { items: next })
                }}>
                  ↑
                </button>
                <button type="button" className="btn-ghost" disabled={i === space.items.length - 1} onClick={() => {
                  const next = space.items.slice()
                  const [row] = next.splice(i, 1)
                  if (row) next.splice(i + 1, 0, row)
                  patchSpace(space.id, { items: next })
                }}>
                  ↓
                </button>
                <button type="button" className="btn-ghost" onClick={() => patchSpace(space.id, { items: space.items.filter((row) => itemKey(row) !== itemKey(it)) })}>
                  Hide
                </button>
              </div>
            ))}
            <Field label="Add a phone app">
              <select
                className="select"
                value=""
                onChange={(e) => {
                  const id = e.target.value
                  if (!id) return
                  const app = SYSTEM_APPS.find((a) => a.id === id)
                  if (!app) return
                  patchSpace(space.id, {
                    items: [...space.items, { kind: 'system', systemId: app.id, label: app.label }],
                  })
                }}
              >
                <option value="">Phone, Messages, Safari…</option>
                {SYSTEM_APPS.filter((a) => !space.items.some((it) => it.systemId === a.id)).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Add a Sepho tool">
              <select
                className="select"
                value=""
                onChange={(e) => {
                  const id = e.target.value as ToolId
                  if (!id) return
                  patchSpace(space.id, { items: [...space.items, { kind: 'tool', toolId: id, label: TOOL_LABEL[id] }] })
                }}
              >
                <option value="">Choose a tool</option>
                {TOOL_IDS.filter((id) => !space.items.some((it) => it.toolId === id)).map((id) => (
                  <option key={id} value={id}>
                    {TOOL_LABEL[id]}
                  </option>
                ))}
              </select>
            </Field>
          </>
        ) : null}
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            const id = uid()
            updateAttention((cur) => ({
              ...cur,
              spaces: [
                ...cur.spaces,
                {
                  id,
                  name: 'New space',
                  items: [{ toolId: 'today', label: TOOL_LABEL.today }],
                  appearance: cur.appearance,
                },
              ],
              activeSpaceId: id,
            }))
          }}
        >
          Add a space
        </button>
        {a.spaces.length > 1 && space ? (
          <button
            type="button"
            className="btn-ghost"
            onClick={() =>
              updateAttention((cur) => {
                const spaces = cur.spaces.filter((s) => s.id !== space.id)
                return { ...cur, spaces, activeSpaceId: spaces[0]?.id ?? cur.activeSpaceId }
              })
            }
          >
            Remove this space
          </button>
        ) : null}
      </section>

      <section className="card stack">
        <h2>Locks</h2>
        <p className="muted">A locked tool still exists. Opening it costs a pause. Settings stay open so you can change the rules.</p>
        {TOOL_IDS.filter((id) => id !== 'settings').map((id) => {
          const lock = a.locks.find((l) => l.toolId === id)
          const on = Boolean(lock?.enabled)
          return (
            <div key={id} className="stack" style={{ gap: 8, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
              <label className="row">
                <input type="checkbox" checked={on} onChange={(e) => patchLock(id, { enabled: e.target.checked })} />
                Lock {TOOL_LABEL[id]}
              </label>
              {on && lock ? (
                <>
                  <p className="kicker">Rituals</p>
                  {(Object.keys(INTERVENTION_LABEL) as InterventionKind[]).map((kind) => (
                    <label key={kind} className="row">
                      <input
                        type="checkbox"
                        checked={lock.interventions.includes(kind)}
                        onChange={(e) => {
                          const interventions = e.target.checked
                            ? [...lock.interventions, kind]
                            : lock.interventions.filter((x) => x !== kind)
                          patchLock(id, { interventions: interventions.length ? interventions : ['pause'] })
                        }}
                      />
                      {INTERVENTION_LABEL[kind]}
                    </label>
                  ))}
                  <label className="row">
                    <input type="checkbox" checked={lock.bypassAllowed} onChange={(e) => patchLock(id, { bypassAllowed: e.target.checked })} />
                    Allow skip (logged)
                  </label>
                  <DayToggles value={lock.days} onChange={(days) => patchLock(id, { days })} />
                  <div className="row">
                    <Field label="From">
                      <input className="input" type="time" value={fmtHM(lock.startMin)} onChange={(e) => patchLock(id, { startMin: parseHM(e.target.value) })} />
                    </Field>
                    <Field label="Until">
                      <input className="input" type="time" value={fmtHM(lock.endMin)} onChange={(e) => patchLock(id, { endMin: parseHM(e.target.value) })} />
                    </Field>
                  </div>
                </>
              ) : null}
            </div>
          )
        })}
      </section>

      <section className="card stack">
        <h2>Detox whitelist</h2>
        <p className="muted">During detox the home keeps Call, Messages, and these tools. Everything else waits.</p>
        {TOOL_IDS.map((id) => (
          <label key={id} className="row">
            <input
              type="checkbox"
              checked={a.detox.whitelist.includes(id)}
              onChange={(e) =>
                updateAttention((cur) => ({
                  ...cur,
                  detox: {
                    ...cur.detox,
                    whitelist: e.target.checked ? [...cur.detox.whitelist, id] : cur.detox.whitelist.filter((x) => x !== id),
                  },
                }))
              }
            />
            {TOOL_LABEL[id]}
          </label>
        ))}
      </section>

      <section className="card stack">
        <h2>Focus profiles</h2>
        <p className="muted">These live with the Focus timer. A profile can change the active space and extra locks. Schedules run on this device.</p>
        {a.profiles.map((p) => (
          <ProfileEditor
            key={p.id}
            profile={p}
            spaces={a.spaces}
            onChange={(patch) =>
              updateAttention((cur) => ({
                ...cur,
                profiles: cur.profiles.map((row) => (row.id === p.id ? { ...row, ...patch } : row)),
              }))
            }
            onRemove={() => updateAttention((cur) => ({ ...cur, profiles: cur.profiles.filter((row) => row.id !== p.id) }))}
          />
        ))}
        <button
          type="button"
          className="btn-ghost"
          onClick={() => updateAttention({ onboarded: false })}
        >
          Replay home setup
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() =>
            updateAttention((cur) => ({
              ...cur,
              profiles: [
                ...cur.profiles,
                {
                  id: uid(),
                  name: 'New profile',
                  spaceId: cur.activeSpaceId,
                  extraLockToolIds: [],
                  days: [],
                  startMin: 9 * 60,
                  endMin: 12 * 60,
                  enabled: false,
                },
              ],
            }))
          }
        >
          Add profile
        </button>
      </section>
    </>
  )
}

function ProfileEditor({
  profile,
  spaces,
  onChange,
  onRemove,
}: {
  profile: FocusProfile
  spaces: AttentionSpace[]
  onChange: (patch: Partial<FocusProfile>) => void
  onRemove: () => void
}) {
  return (
    <div className="stack" style={{ gap: 8, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
      <Field label="Name">
        <input className="input" value={profile.name} onChange={(e) => onChange({ name: e.target.value })} />
      </Field>
      <label className="row">
        <input type="checkbox" checked={profile.enabled} onChange={(e) => onChange({ enabled: e.target.checked })} />
        Run on a schedule
      </label>
      <Field label="Space">
        <select className="select" value={profile.spaceId} onChange={(e) => onChange({ spaceId: e.target.value })}>
          {spaces.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>
      <DayToggles value={profile.days} onChange={(days) => onChange({ days })} />
      <div className="row">
        <Field label="From">
          <input className="input" type="time" value={fmtHM(profile.startMin)} onChange={(e) => onChange({ startMin: parseHM(e.target.value) })} />
        </Field>
        <Field label="Until">
          <input className="input" type="time" value={fmtHM(profile.endMin)} onChange={(e) => onChange({ endMin: parseHM(e.target.value) })} />
        </Field>
      </div>
      <p className="kicker">Also lock</p>
      {TOOL_IDS.filter((id) => id !== 'settings').map((id) => (
        <label key={id} className="row">
          <input
            type="checkbox"
            checked={profile.extraLockToolIds.includes(id)}
            onChange={(e) =>
              onChange({
                extraLockToolIds: e.target.checked
                  ? [...profile.extraLockToolIds, id]
                  : profile.extraLockToolIds.filter((x) => x !== id),
              })
            }
          />
          {TOOL_LABEL[id]}
        </label>
      ))}
      <button type="button" className="btn-ghost" onClick={onRemove}>
        Remove profile
      </button>
    </div>
  )
}
