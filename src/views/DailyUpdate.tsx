import { useEffect, useRef, useState } from 'react'
import { NoteEditor } from '../components/NoteEditor'
import { formatLong } from '../lib/dates'
import { emptyJournalDraft, readJournalDraft, writeJournalDraft, type JournalDraft } from '../lib/journal-draft'
import { quoteForDate } from '../lib/quotes'
import type { JournalEntry, Workout } from '../lib/types'
import { flushPersist, useStore } from '../store'

const WORKOUTS: { id: Workout; label: string }[] = [
  { id: 'cardio', label: 'Cardio' },
  { id: 'weights', label: 'Weights' },
  { id: 'rest', label: 'Rest day' },
  { id: 'other', label: 'Other' },
]

type Draft = JournalDraft

function fromEntry(e?: JournalEntry): Draft {
  if (!e) return emptyJournalDraft()
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
  const [draft, setDraft] = useState<Draft>(() => readJournalDraft(date, entry) ?? fromEntry(entry))
  const [savedFlash, setSavedFlash] = useState(false)
  const draftRef = useRef(draft)
  draftRef.current = draft

  const commit = (next = draftRef.current) => {
    writeJournalDraft(date, next)
    upsertJournal(date, { ...next, body: next.actionsToday })
    flushPersist()
  }

  const patchDraft = (next: Draft) => {
    draftRef.current = next
    writeJournalDraft(date, next)
    setDraft(next)
  }

  useEffect(() => {
    const save = () => commit()
    window.addEventListener('pagehide', save)
    window.addEventListener('beforeunload', save)
    const vis = () => {
      if (document.hidden) save()
    }
    document.addEventListener('visibilitychange', vis)
    return () => {
      save()
      window.removeEventListener('pagehide', save)
      window.removeEventListener('beforeunload', save)
      document.removeEventListener('visibilitychange', vis)
    }
  }, [date])

  useEffect(() => {
    const t = window.setTimeout(() => {
      commit(draftRef.current)
      setSavedFlash(true)
    }, 300)
    return () => window.clearTimeout(t)
  }, [date, draft])

  const setBlessing = (i: number, value: string) => {
    const blessings = [...draftRef.current.blessings] as [string, string, string]
    blessings[i] = value
    patchDraft({ ...draftRef.current, blessings })
  }

  return (
    <article className="daily-page">
      <header className="daily-hero">
        <p className="daily-kicker">The successful man</p>
        <h2>Daily update</h2>
        <p className="daily-quote">“{quote.text}”</p>
        <p className="daily-by">{quote.by}</p>
        <p className="daily-saved">{savedFlash ? 'Saved on this device' : 'Saves as you write'}</p>
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
                onClick={() =>
                  patchDraft({ ...draftRef.current, workout: draftRef.current.workout === w.id ? undefined : w.id })
                }
              >
                <span className="daily-bullet" data-on={draft.workout === w.id ? 'true' : 'false'} />
                {w.label}
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="daily-write">
        <p className="daily-label">Current goals</p>
        <NoteEditor
          noteId={`${date}:goals`}
          value={draft.currentGoals}
          onChange={(currentGoals) => patchDraft({ ...draftRef.current, currentGoals })}
          compact
          placeholder="What you’re building toward."
        />
      </section>

      <div className="daily-split">
        <section className="daily-write">
          <p className="daily-label">Actions I took today</p>
          <NoteEditor
            noteId={`${date}:today`}
            value={draft.actionsToday}
            onChange={(actionsToday) => patchDraft({ ...draftRef.current, actionsToday })}
            compact
            tall
            placeholder="What you actually did."
          />
        </section>
        <section className="daily-write">
          <p className="daily-label">Actions I’ll take tomorrow</p>
          <NoteEditor
            noteId={`${date}:tomorrow`}
            value={draft.actionsTomorrow}
            onChange={(actionsTomorrow) => patchDraft({ ...draftRef.current, actionsTomorrow })}
            compact
            tall
            placeholder="The next move."
          />
        </section>
      </div>

      <section>
        <p className="daily-label">Daily affirmation</p>
        <input
          className="daily-affirm"
          placeholder="A sentence to carry."
          value={draft.affirmation}
          onChange={(e) => patchDraft({ ...draftRef.current, affirmation: e.target.value })}
        />
      </section>
    </article>
  )
}
