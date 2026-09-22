import { useState } from 'react'
import { addDays, parseISO, toISO, todayISO } from '../lib/dates'
import { DailyUpdate } from './DailyUpdate'

export function Journal() {
  const today = todayISO()
  const [date, setDate] = useState(today)

  return (
    <div>
      <header className="page-head page-head-route">
        <div>
          <p className="kicker">Daily update</p>
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
      <DailyUpdate date={date} />
    </div>
  )
}
