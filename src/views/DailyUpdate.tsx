import { useEffect, useState } from 'react'
import { formatLong } from '../lib/dates'
import { quoteForDate } from '../lib/quotes'
import type { JournalEntry, Workout } from '../lib/types'
import { useStore } from '../store'

const WORKOUTS: { id: Workout; label: string }[] = [
  { id: 'cardio', label: 'Cardio' },
  { id: 'weights', label: 'Weights' },
  { id: 'rest', label: 'Rest day' },
  { id: 'other', label: 'Other' },
]

type Draft = Pick<
  JournalEntry,
  'blessings' | 'workout' | 'currentGoals' | 'actionsToday' | 'actionsTomorrow' | 'affirmation'
>

function emptyDraft(): Draft {
  return {
    blessings: ['', '', ''],
    workout: undefined,
    currentGoals: '',
    actionsToday: '',
    actionsTomorrow: '',
    affirmation: '',
  }
}

function fromEntry(e?: JournalEntry): Draft {
  if (!e) return emptyDraft()
  return {
    blessings: e.blessings ?? ['', '', ''],
    workout: e.workout,
    currentGoals: e.currentGoals ?? '',
    actionsToday: e.actionsToday || e.body || '',
    actionsTomorrow: e.actionsTomorrow ?? '',
    affirmation: e.affirmation ?? '',
  }
}

export function DailyUpdate({ date }: { date: string }) {
  const { state, upsertJournal } = useStore()
  const entry = state.journal.find((j) => j.date === date)
  const quote = quoteForDate(date)
  const [draft, setDraft] = useState<Draft>(() => fromEntry(entry))

  useEffect(() => {
    setDraft(fromEntry(state.journal.find((j) => j.date === date)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  useEffect(() => {
    const current = fromEntry(entry)
    if (JSON.stringify(draft) === JSON.stringify(current)) return
    const t = window.setTimeout(() => {
      upsertJournal(date, { ...draft, body: draft.actionsToday })
    }, 400)
    return () => window.clearTimeout(t)
  }, [date, draft, entry, upsertJournal])

  const setBlessing = (i: number, value: string) => {
    const blessings = [...draft.blessings] as [string, string, string]
    blessings[i] = value
    setDraft({ ...draft, blessings })
  }

  return (
    <article className="daily-page">
      <header className="daily-hero">
        <p className="daily-kicker">The successful man</p>
        <h2>Daily update</h2>
        <p className="daily-quote">“{quote.text}”</p>
        <p className="daily-by">{quote.by}</p>
      </header>

      <div className="daily-top">
        <section>
          <p className="daily-label">Three blessings</p>
          <ol className="daily-blessings">
            {draft.blessings.map((b, i) => (
              <li key={i}>
                <span className="daily-bullet" data-on={b.trim() ? 'true' : 'false'} />
                <input
                  value={b}
                  onChange={(e) => setBlessing(i, e.target.value)}
                  placeholder={`Blessing ${i + 1}`}
                  aria-label={`Blessing ${i + 1}`}
                />
              </li>
            ))}
          </ol>
        </section>

        <section>
          <p className="daily-label">Date</p>
          <p className="daily-date">{formatLong(date)}</p>
          <p className="daily-label" style={{ marginTop: 18 }}>
            Workout
          </p>
          <div className="daily-workout">
            {WORKOUTS.map((w) => (
              <button
                key={w.id}
                type="button"
                className="daily-opt"
                data-on={draft.workout === w.id}
                onClick={() => setDraft({ ...draft, workout: draft.workout === w.id ? undefined : w.id })}
              >
                <span className="daily-bullet" data-on={draft.workout === w.id ? 'true' : 'false'} />
                {w.label}
              </button>
            ))}
          </div>
        </section>
      </div>

      <section>
        <p className="daily-label">Goals I am currently working towards</p>
        <textarea
          className="daily-box"
          rows={4}
          placeholder="What you’re building toward."
          value={draft.currentGoals}
          onChange={(e) => setDraft({ ...draft, currentGoals: e.target.value })}
        />
      </section>

      <div className="daily-split">
        <section>
          <p className="daily-label">What actions did I take today to help achieve my goals</p>
          <textarea
            className="daily-box daily-box-tall"
            placeholder="What you actually did."
            value={draft.actionsToday}
            onChange={(e) => setDraft({ ...draft, actionsToday: e.target.value })}
          />
        </section>
        <section>
          <p className="daily-label">What actions will I take tomorrow to help achieve my goals</p>
          <textarea
            className="daily-box daily-box-tall"
            placeholder="The next move."
            value={draft.actionsTomorrow}
            onChange={(e) => setDraft({ ...draft, actionsTomorrow: e.target.value })}
          />
        </section>
      </div>

      <section>
        <p className="daily-label">Daily affirmation</p>
        <input
          className="daily-affirm"
          placeholder="A sentence to carry."
          value={draft.affirmation}
          onChange={(e) => setDraft({ ...draft, affirmation: e.target.value })}
        />
      </section>
    </article>
  )
}
