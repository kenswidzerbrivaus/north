import { useEffect, useState } from 'react'
import { Check } from '../components/ui'
import type { JournalEntry } from '../lib/types'
import { useStore } from '../store'

const FALLBACK: [string, string, string] = ['Prayer', 'Self affirmation', 'Read through journal']

type Draft = Pick<JournalEntry, 'shortTermGoal' | 'morningChecks'>

function fromEntry(e?: JournalEntry): Draft {
  return {
    shortTermGoal: e?.shortTermGoal ?? '',
    morningChecks: e?.morningChecks ?? [false, false, false],
  }
}

export function MorningRoutine({ date, compact }: { date: string; compact?: boolean }) {
  const { state, upsertJournal } = useStore()
  const labels = state.settings.morningRituals ?? FALLBACK
  const entry = state.journal.find((j) => j.date === date)
  const [draft, setDraft] = useState<Draft>(() => fromEntry(entry))

  useEffect(() => {
    setDraft(fromEntry(state.journal.find((j) => j.date === date)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  useEffect(() => {
    const current = fromEntry(entry)
    if (JSON.stringify(draft) === JSON.stringify(current)) return
    const t = window.setTimeout(() => upsertJournal(date, draft), 200)
    return () => window.clearTimeout(t)
  }, [date, draft, entry, upsertJournal])

  const toggle = (i: number) => {
    const morningChecks = [...draft.morningChecks] as [boolean, boolean, boolean]
    morningChecks[i] = !morningChecks[i]
    setDraft({ ...draft, morningChecks })
  }

  return (
    <article className={`morning${compact ? ' is-compact' : ''}`}>
      {compact ? null : <div className="morning-rail">SEPHO</div>}
      <div className="morning-body">
        {compact ? null : <div className="morning-banner">Morning protocol</div>}
        <div className="morning-grid">
          <div className="morning-fields">
            <section className="morning-box">
              <p className="daily-label">North star</p>
              <textarea
                className="morning-goal"
                rows={2}
                placeholder="Build ______"
                value={draft.shortTermGoal}
                onChange={(e) => setDraft({ ...draft, shortTermGoal: e.target.value })}
              />
            </section>
            <section className="morning-box">
              <p className="daily-label">First three after waking</p>
              <ol className="daily-blessings">
                {labels.map((label, i) => (
                  <li key={i}>
                    <Check on={draft.morningChecks[i]} onClick={() => toggle(i)} label={label || FALLBACK[i]} />
                    <button type="button" className="morning-check-label" onClick={() => toggle(i)}>
                      {label || FALLBACK[i]}
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          </div>
          <p className="morning-mark">
            Win the
            <br />
            morning.
          </p>
        </div>
      </div>
    </article>
  )
}
