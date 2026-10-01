import { useEffect, useState } from 'react'
import type { GateDecision } from '../lib/attention'
import type { InterventionKind, ToolId } from '../lib/types'

const REP_TARGET = 10
const PAUSE_SEC = 8
const BREATH_SEC = 16

function Ritual({
  kind,
  onDone,
}: {
  kind: InterventionKind
  onDone: () => void
}) {
  const [left, setLeft] = useState(kind === 'breath' ? BREATH_SEC : kind === 'pause' ? PAUSE_SEC : 0)
  const [reps, setReps] = useState(0)
  const [outside, setOutside] = useState(false)

  useEffect(() => {
    if (kind !== 'breath' && kind !== 'pause') return
    const start = kind === 'breath' ? BREATH_SEC : PAUSE_SEC
    setLeft(start)
    const t = window.setInterval(() => {
      setLeft((n) => {
        if (n <= 1) {
          window.clearInterval(t)
          return 0
        }
        return n - 1
      })
    }, 1000)
    return () => window.clearInterval(t)
  }, [kind])

  if (kind === 'breath') {
    const phase = left > 8 ? 'Inhale' : 'Exhale'
    return (
      <div className="lock-ritual">
        <p className="lock-kicker">{phase}</p>
        <p className="lock-count">{left}</p>
        <p className="lock-copy">Sixteen seconds. Then the tool is still there.</p>
        <button className="lock-go" type="button" disabled={left > 0} onClick={onDone}>
          {left > 0 ? 'Breathe' : 'Continue'}
        </button>
      </div>
    )
  }

  if (kind === 'pause') {
    return (
      <div className="lock-ritual">
        <p className="lock-kicker">Pause</p>
        <p className="lock-count">{left}</p>
        <p className="lock-copy">Are you sure you want this right now?</p>
        <button className="lock-go" type="button" disabled={left > 0} onClick={onDone}>
          {left > 0 ? 'Wait' : 'Open it'}
        </button>
      </div>
    )
  }

  if (kind === 'reps') {
    return (
      <div className="lock-ritual">
        <p className="lock-kicker">Body first</p>
        <p className="lock-count">
          {reps}/{REP_TARGET}
        </p>
        <p className="lock-copy">Tap once per push-up, squat, or whatever you chose.</p>
        {reps < REP_TARGET ? (
          <button className="lock-go" type="button" onClick={() => setReps((n) => n + 1)}>
            Count one
          </button>
        ) : (
          <button className="lock-go" type="button" onClick={onDone}>
            Continue
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="lock-ritual">
      <p className="lock-kicker">Outside</p>
      <p className="lock-copy">Step out, feel air, then confirm. The tool will wait.</p>
      <label className="lock-check">
        <input type="checkbox" checked={outside} onChange={(e) => setOutside(e.target.checked)} />
        I went outside
      </label>
      <button className="lock-go" type="button" disabled={!outside} onClick={onDone}>
        Continue
      </button>
    </div>
  )
}

export function LockGate({
  toolLabel,
  decision,
  onCancel,
  onUnlock,
  onBypass,
  onEndDetox,
}: {
  toolLabel: string
  decision: GateDecision
  onCancel: () => void
  onUnlock: () => void
  onBypass?: () => void
  onEndDetox?: () => void
}) {
  const steps: InterventionKind[] = decision.interventions.length ? decision.interventions : ['pause']
  const [i, setI] = useState(0)
  const kind: InterventionKind = steps[Math.min(i, steps.length - 1)] ?? 'pause'

  if (decision.reason === 'detox') {
    return (
      <div className="lock-gate" role="dialog" aria-modal="true" aria-label="Quiet hours">
        <div className="lock-card">
          <p className="lock-kicker">Quiet hours</p>
          <h2>{toolLabel}</h2>
          <p className="lock-copy">{decision.message}</p>
          <button className="lock-go" type="button" onClick={onCancel}>
            Stay here
          </button>
          {onEndDetox ? (
            <button className="lock-skip" type="button" onClick={onEndDetox}>
              End detox
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  const next = () => {
    if (i + 1 >= steps.length) onUnlock()
    else setI((n) => n + 1)
  }

  return (
    <div className="lock-gate" role="dialog" aria-modal="true" aria-label="A pause">
      <div className="lock-card">
        <p className="lock-kicker">{toolLabel}</p>
        <p className="lock-copy">{decision.message}</p>
        <Ritual key={kind} kind={kind} onDone={next} />
        <button className="lock-back" type="button" onClick={onCancel}>
          Not now
        </button>
        {decision.bypassAllowed && onBypass ? (
          <button className="lock-skip" type="button" onClick={onBypass}>
            Skip this time
          </button>
        ) : null}
      </div>
    </div>
  )
}

export type PendingGate = { toolId: ToolId; label: string; decision: GateDecision }
