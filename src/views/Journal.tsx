import { useState } from 'react'
import { addDays, formatLong, monthCells, parseISO, toISO, todayISO, weekdayNames } from '../lib/dates'
import { useStore } from '../store'

const MOODS = [
  { n: 1 as const, label: 'Distant' },
  { n: 2 as const, label: 'Heavy' },
  { n: 3 as const, label: 'Steady' },
  { n: 4 as const, label: 'Light' },
  { n: 5 as const, label: 'Electric' },
]

export function Journal() {
  const { state, upsertJournal } = useStore()
  const today = todayISO()
  const [date, setDate] = useState(today)
  const entry = state.journal.find((j) => j.date === date)
  const cursor = parseISO(date)
  const cells = monthCells(cursor.getFullYear(), cursor.getMonth(), state.settings.weekStartsOn)
  const logged = new Set(state.journal.filter((j) => j.body.trim() || j.mood).map((j) => j.date))

  return (
    <div>
      <header className="page-head">
        <div>
          <p className="kicker">A page for the day</p>
          <h1>Journal</h1>
        </div>
        <div className="row">
          <button className="btn-ghost" onClick={() => setDate(toISO(addDays(parseISO(date), -1)))}>
            Previous
          </button>
          <button className="btn-ghost" onClick={() => setDate(today)}>
            Today
          </button>
          <button className="btn-ghost" onClick={() => setDate(toISO(addDays(parseISO(date), 1)))}>
            Next
          </button>
        </div>
      </header>

      <div className="grid-2">
        <section className="card">
          <div className="cal-month" style={{ border: 0, boxShadow: 'none' }}>
            {weekdayNames(state.settings.weekStartsOn).map((n) => (
              <div key={n} className="cal-hd">
                {n}
              </div>
            ))}
            {cells.map((c) => (
              <button
                key={c.iso}
                className={`cal-cell${c.inMonth ? '' : ' out'}${c.iso === date ? ' today' : ''}`}
                style={{ minHeight: 48 }}
                onClick={() => setDate(c.iso)}
              >
                <span className="day-num">{c.date.getDate()}</span>
                {logged.has(c.iso) ? <span className="dot" style={{ background: 'var(--accent)' }} /> : null}
              </button>
            ))}
          </div>
        </section>
        <section className="card">
          <p className="kicker">{formatLong(date)}</p>
          <h2 style={{ margin: '6px 0 12px' }}>How did it feel?</h2>
          <div className="mood">
            {MOODS.map((m) => (
              <button
                key={m.n}
                data-on={entry?.mood === m.n}
                onClick={() => upsertJournal(date, { mood: m.n, body: entry?.body ?? '' })}
              >
                {m.label}
              </button>
            ))}
          </div>
          <textarea
            className="textarea"
            style={{ marginTop: 14, minHeight: 280 }}
            placeholder="What moved. What you noticed. What you’ll leave here."
            value={entry?.body ?? ''}
            onChange={(e) => upsertJournal(date, { body: e.target.value, mood: entry?.mood })}
          />
        </section>
      </div>
    </div>
  )
}
