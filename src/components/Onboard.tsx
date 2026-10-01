import { useMemo, useState } from 'react'
import { defaultAttention, TOOL_IDS, TOOL_LABEL } from '../lib/attention'
import type { Attention, ToolId } from '../lib/types'

const DEFAULT_ESSENTIALS: ToolId[] = ['today', 'tasks', 'calendar', 'focus', 'notes', 'journal']
const DEFAULT_LOCKS: ToolId[] = ['projects', 'goals']

function Weeks({ age }: { age: number }) {
  const lived = Math.max(0, Math.min(90, age)) * 52
  return (
    <div className="life-weeks" aria-hidden>
      {Array.from({ length: 90 }, (_, year) => (
        <span key={year} className="life-row">
          {Array.from({ length: 52 }, (_, w) => {
            const i = year * 52 + w
            return <i key={w} className={i < lived ? 'is-lived' : undefined} />
          })}
        </span>
      ))}
    </div>
  )
}

export function Onboard({
  onFinish,
}: {
  onFinish: (next: Attention) => void
}) {
  const [step, setStep] = useState(0)
  const [age, setAge] = useState(30)
  const [hours, setHours] = useState(3)
  const [showWeeks, setShowWeeks] = useState(true)
  const [essentials, setEssentials] = useState<ToolId[]>(DEFAULT_ESSENTIALS)
  const [locks, setLocks] = useState<ToolId[]>(DEFAULT_LOCKS)
  const [spaceId, setSpaceId] = useState('work')
  const [startDetox, setStartDetox] = useState(false)

  const lostDays = useMemo(() => Math.round((hours * 365 * Math.max(0, 90 - age)) / 24), [hours, age])

  const toggle = (list: ToolId[], id: ToolId, set: (v: ToolId[]) => void) => {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
  }

  const finish = () => {
    const base = defaultAttention()
    const spaces = base.spaces.map((s) =>
      s.id === spaceId
        ? {
            ...s,
            items: (essentials.length ? essentials : DEFAULT_ESSENTIALS).map((toolId) => ({
              toolId,
              label: TOOL_LABEL[toolId],
            })),
          }
        : s,
    )
    const until = startDetox
      ? (() => {
          const d = new Date()
          d.setHours(24, 0, 0, 0)
          return d.toISOString()
        })()
      : undefined
    onFinish({
      ...base,
      onboarded: true,
      spaces,
      activeSpaceId: spaceId,
      locks: locks
        .filter((id) => !essentials.includes(id))
        .map((toolId) => ({
          toolId,
          enabled: true,
          interventions: ['pause', 'breath'] as const,
          bypassAllowed: false,
          days: [],
          startMin: 0,
          endMin: 24 * 60,
          profileIds: [],
        })),
      detox: {
        ...base.detox,
        active: startDetox,
        until,
        startedAt: startDetox ? new Date().toISOString() : undefined,
        whitelist: essentials.filter((id) => id === 'today' || id === 'journal' || id === 'focus').slice(0, 3).length
          ? essentials.filter((id) => ['today', 'journal', 'focus', 'notes'].includes(id))
          : ['today', 'journal'],
      },
    })
  }

  return (
    <div className="onboard">
      {step === 0 ? (
        <section className="onboard-card">
          <p className="lock-kicker">Setup</p>
          <h1>A calm desk. Tools when you mean them.</h1>
          <p className="lock-copy">
            Pick a short list for the home screen. Everything else stays in the library. Locks add a pause before the noisy
            tools. A few minutes is enough.
          </p>
          <label className="lock-check">
            <input type="checkbox" checked={showWeeks} onChange={(e) => setShowWeeks(e.target.checked)} />
            Show life in weeks
          </label>
          {showWeeks ? (
            <>
              <label className="field">
                <span>Age</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={90}
                  value={age}
                  onChange={(e) => setAge(Math.max(1, Math.min(90, Number(e.target.value) || 1)))}
                />
              </label>
              <label className="field">
                <span>Hours a day on a phone (guess)</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={16}
                  value={hours}
                  onChange={(e) => setHours(Math.max(0, Math.min(16, Number(e.target.value) || 0)))}
                />
              </label>
              <Weeks age={age} />
              <p className="lock-copy">
                Each row is a year. Filled weeks already happened. At {hours} hours a day, that is about {lostDays} days of
                remaining life facing a screen.
              </p>
            </>
          ) : null}
          <button className="lock-go" type="button" onClick={() => setStep(1)}>
            Continue
          </button>
          <button
            className="lock-skip"
            type="button"
            onClick={() => {
              const base = defaultAttention()
              onFinish({
                ...base,
                onboarded: true,
                spaces: base.spaces.map((s) =>
                  s.id === 'work'
                    ? { ...s, items: TOOL_IDS.map((toolId) => ({ toolId, label: TOOL_LABEL[toolId] })) }
                    : s,
                ),
                locks: [],
              })
            }}
          >
            Skip setup
          </button>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="onboard-card">
          <p className="lock-kicker">Essentials</p>
          <h1>What belongs on the home list?</h1>
          <p className="lock-copy">Hidden is not gone. Search still opens every tool.</p>
          <ul className="onboard-picks">
            {TOOL_IDS.map((id) => (
              <li key={id}>
                <label className="lock-check">
                  <input
                    type="checkbox"
                    checked={essentials.includes(id)}
                    onChange={() => toggle(essentials, id, setEssentials)}
                  />
                  {TOOL_LABEL[id]}
                </label>
              </li>
            ))}
          </ul>
          <button className="lock-go" type="button" onClick={() => setStep(2)}>
            Continue
          </button>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="onboard-card">
          <p className="lock-kicker">Distractions</p>
          <h1>Which tools should cost a pause?</h1>
          <p className="lock-copy">They stay in the app. Opening them takes a breath first.</p>
          <ul className="onboard-picks">
            {TOOL_IDS.filter((id) => id !== 'settings').map((id) => (
              <li key={id}>
                <label className="lock-check">
                  <input type="checkbox" checked={locks.includes(id)} onChange={() => toggle(locks, id, setLocks)} />
                  {TOOL_LABEL[id]}
                </label>
              </li>
            ))}
          </ul>
          <button className="lock-go" type="button" onClick={() => setStep(3)}>
            Continue
          </button>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="onboard-card">
          <p className="lock-kicker">Space</p>
          <h1>Which room do you land in?</h1>
          <div className="onboard-picks">
            {defaultAttention().spaces.map((s) => (
              <button
                key={s.id}
                type="button"
                className="lock-go"
                data-quiet={spaceId !== s.id}
                onClick={() => setSpaceId(s.id)}
              >
                {s.name}
              </button>
            ))}
          </div>
          <label className="lock-check">
            <input type="checkbox" checked={startDetox} onChange={(e) => setStartDetox(e.target.checked)} />
            Start detox until midnight
          </label>
          <button className="lock-go" type="button" onClick={finish}>
            Enter
          </button>
        </section>
      ) : null}
    </div>
  )
}
