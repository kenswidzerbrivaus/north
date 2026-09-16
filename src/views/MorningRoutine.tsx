import { useEffect, useState } from 'react'
import type { JournalEntry } from '../lib/types'
import { useStore } from '../store'

type Draft = Pick<JournalEntry, 'shortTermGoal' | 'morningWins'>

function fromEntry(e?: JournalEntry): Draft {
  return {
    shortTermGoal: e?.shortTermGoal ?? '',
    morningWins: e?.morningWins ?? ['', '', ''],
  }
}

export function MorningRoutine({ date }: { date: string }) {
  const { state, upsertJournal } = useStore()
  const entry = state.journal.find((j) => j.date === date)
  const [draft, setDraft] = useState<Draft>(() => fromEntry(entry))

  useEffect(() => {
    setDraft(fromEntry(state.journal.find((j) => j.date === date)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  useEffect(() => {
    const current = fromEntry(entry)
    if (JSON.stringify(draft) === JSON.stringify(current)) return
    const t = window.setTimeout(() => upsertJournal(date, draft), 400)
    return () => window.clearTimeout(t)
  }, [date, draft, entry, upsertJournal])

  const setWin = (i: number, value: string) => {
    const morningWins = [...draft.morningWins] as [string, string, string]
    morningWins[i] = value
    setDraft({ ...draft, morningWins })
  }

  return (
    <article className="morning">
      <div className="morning-rail">The successful man</div>
      <div className="morning-body">
        <div className="morning-banner">Morning routine</div>
        <div className="morning-grid">
          <div className="morning-fields">
            <section className="morning-box">
              <p className="daily-label">Short term goal</p>
              <textarea
                className="morning-goal"
                rows={3}
                placeholder="What you’re driving this season."
                value={draft.shortTermGoal}
                onChange={(e) => setDraft({ ...draft, shortTermGoal: e.target.value })}
              />
            </section>
            <section className="morning-box">
              <p className="daily-label">List the first three things you are going to do after you wake up to achieve small wins.</p>
              <ol className="daily-blessings">
                {draft.morningWins.map((w, i) => (
                  <li key={i}>
                    <span className="daily-bullet" data-on={w.trim() ? 'true' : 'false'} />
                    <input
                      value={w}
                      onChange={(e) => setWin(i, e.target.value)}
                      placeholder={['Prayer', 'Self affirmation', 'Read through journal'][i]}
                      aria-label={`Morning win ${i + 1}`}
                    />
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
