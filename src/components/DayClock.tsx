import { useEffect, useState } from 'react'

function nowHiRes() {
  return performance.timeOrigin + performance.now()
}

function msUntilMidnight(from = nowHiRes()) {
  const wall = new Date()
  const end = new Date(wall.getFullYear(), wall.getMonth(), wall.getDate() + 1).getTime()
  return Math.max(0, end - from)
}

function formatDayLeft(ms: number) {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  const milli = Math.floor(ms % 1000)
  const micro = Math.floor((ms * 1000) % 1000)
  return {
    h,
    m: String(m).padStart(2, '0'),
    s: String(s).padStart(2, '0'),
    ms: String(milli).padStart(3, '0'),
    us: String(micro).padStart(3, '0'),
  }
}

export function DayClock() {
  const [left, setLeft] = useState(() => msUntilMidnight())
  useEffect(() => {
    let raf = 0
    const tick = () => {
      setLeft(msUntilMidnight())
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  const t = formatDayLeft(left)
  const hours = left / 3_600_000
  const heat = hours < 1 ? 'is-critical' : hours < 6 ? 'is-hot' : 'is-warn'
  return (
    <div className={`day-clock hud-frame ${heat}`}>
      <span className="kicker">⚠ Time remaining</span>
      <b>
        {t.h}H {t.m}M {t.s}S {t.ms}MS {t.us}μS
      </b>
      <span className="kicker">Until midnight</span>
    </div>
  )
}
