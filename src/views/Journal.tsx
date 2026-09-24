import { useEffect, useMemo, useState } from 'react'
import { addDays, formatLong, parseISO, toISO, todayISO } from '../lib/dates'
import { journalHasWriting, journalPreview } from '../lib/journal-draft'
import { notePlainText, sanitizeNoteHtml, toEditorHtml } from '../lib/note-body'
import { quoteForDate } from '../lib/quotes'
import type { JournalEntry, Workout } from '../lib/types'
import { useStore } from '../store'
import { DailyUpdate } from './DailyUpdate'

const WORKOUT_LABEL: Record<Workout, string> = {
  cardio: 'Cardio',
  weights: 'Weights',
  rest: 'Rest day',
  other: 'Other',
}

export function Journal() {
  const today = todayISO()
  const { state, updateSettings } = useStore()
  const [mode, setMode] = useState<'write' | 'archive'>('write')
  const [date, setDate] = useState(today)
  const [opened, setOpened] = useState<string | null>(null)
  const from = state.settings.journalArchiveFrom || today

  useEffect(() => {
    if (!state.settings.journalArchiveFrom) updateSettings({ journalArchiveFrom: today })
  }, [state.settings.journalArchiveFrom, today, updateSettings])

  const archived = useMemo(
    () =>
      [...state.journal]
        .filter((j) => j.date >= from && journalHasWriting(j))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [from, state.journal],
  )

  const reading = mode === 'archive' && opened ? archived.find((j) => j.date === opened) : undefined

  return (
    <div className="journal-page">
      <header className="page-head page-head-route">
        <div>
          <p className="kicker">Daily update</p>
          <h1>Journal</h1>
        </div>
        <div className="row journal-modes">
          <button
            className="btn-ghost"
            type="button"
            data-on={mode === 'write'}
            onClick={() => {
              setMode('write')
              setOpened(null)
              setDate(today)
            }}
          >
            Write
          </button>
          <button
            className="btn-ghost"
            type="button"
            data-on={mode === 'archive'}
            onClick={() => {
              setMode('archive')
              setOpened(null)
            }}
          >
            Archive
          </button>
        </div>
      </header>

      {mode === 'write' ? (
        <>
          <div className="row journal-days">
            <button className="btn-ghost" type="button" onClick={() => setDate(toISO(addDays(parseISO(date), -1)))}>
              Previous
            </button>
            <button className="btn-ghost" type="button" data-on={date === today} onClick={() => setDate(today)}>
              Today
            </button>
            <button className="btn-ghost" type="button" onClick={() => setDate(toISO(addDays(parseISO(date), 1)))}>
              Next
            </button>
          </div>
          <DailyUpdate key={date} date={date} />
        </>
      ) : reading ? (
        <JournalRead
          entry={reading}
          onBack={() => setOpened(null)}
          onEdit={() => {
            if (opened) setDate(opened)
            setOpened(null)
            setMode('write')
          }}
        />
      ) : (
        <section className="journal-archive">
          <p className="muted">
            Archive starts {formatLong(from)}. Days you write from here on land in this list.
          </p>
          {archived.length === 0 ? (
            <p className="empty-copy">Nothing filed yet. Write today, then it shows up here.</p>
          ) : (
            <div className="journal-archive-list">
              {archived.map((j) => (
                <button key={j.date} type="button" className="journal-archive-row" onClick={() => setOpened(j.date)}>
                  <strong>{formatLong(j.date)}</strong>
                  <span>{journalPreview(j)}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function JournalRead({
  entry,
  onBack,
  onEdit,
}: {
  entry: JournalEntry
  onBack: () => void
  onEdit: () => void
}) {
  const quote = quoteForDate(entry.date)
  const blessings = (entry.blessings ?? ['', '', '']).filter((b) => b.trim())
  return (
    <article className="daily-page journal-read">
      <div className="row journal-read-bar">
        <button className="btn-ghost" type="button" onClick={onBack}>
          Archive
        </button>
        <button className="btn" type="button" onClick={onEdit}>
          Edit this day
        </button>
      </div>
      <header className="daily-hero">
        <p className="daily-kicker">Filed</p>
        <h2>{formatLong(entry.date)}</h2>
        <p className="daily-quote">“{quote.text}”</p>
        <p className="daily-by">{quote.by}</p>
      </header>
      {blessings.length ? (
        <section>
          <p className="daily-label">Three blessings</p>
          <ol className="daily-blessings">
            {blessings.map((b, i) => (
              <li key={`${i}-${b}`}>
                <span className="daily-bullet" data-on="true" />
                <span>{b}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      {entry.workout ? (
        <section>
          <p className="daily-label">Workout</p>
          <p>{WORKOUT_LABEL[entry.workout]}</p>
        </section>
      ) : null}
      <ReadBlock label="Current goals" html={entry.currentGoals} />
      <ReadBlock label="Actions I took today" html={entry.actionsToday || entry.body} />
      <ReadBlock label="Actions I’ll take tomorrow" html={entry.actionsTomorrow} />
      <ReadBlock label="Key mistakes" html={entry.mistakesToday} />
      <ReadBlock label="How I could’ve done it better" html={entry.mistakeReflection} />
      {notePlainText(entry.affirmation) ? (
        <section>
          <p className="daily-label">Daily affirmation</p>
          <p className="daily-affirm">{entry.affirmation}</p>
        </section>
      ) : null}
    </article>
  )
}

function ReadBlock({ label, html }: { label: string; html?: string }) {
  const text = notePlainText(html || '')
  if (!text) return null
  return (
    <section>
      <p className="daily-label">{label}</p>
      <div className="journal-html" dangerouslySetInnerHTML={{ __html: sanitizeNoteHtml(toEditorHtml(html || '')) }} />
    </section>
  )
}
