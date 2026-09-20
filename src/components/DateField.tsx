import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../icons'
import { monthCells, monthName, parseDeadline, parseISO, todayISO, weekdayNames } from '../lib/dates'

/** In-app date field. Native type=date inside the HUD modal paints iOS/Safari black. */
export function DateField({
  value,
  onChange,
  name,
  placeholder = 'YYYY-MM-DD',
  'aria-label': ariaLabel,
}: {
  value: string
  onChange: (iso: string) => void
  name?: string
  placeholder?: string
  'aria-label'?: string
}) {
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : parseDeadline(value)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(value)
  const [view, setView] = useState(() => {
    const d = iso ? parseISO(iso) : new Date()
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  const wrapRef = useRef<HTMLDivElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 8, left: 8, width: 280 })

  useEffect(() => {
    setText(value)
  }, [value])

  useEffect(() => {
    if (!open) return
    const d = iso ? parseISO(iso) : new Date()
    setView({ y: d.getFullYear(), m: d.getMonth() })
  }, [iso, open])

  const place = () => {
    const el = wrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const width = Math.max(280, Math.min(320, window.innerWidth - 16))
    let top = r.bottom + 6
    let left = r.left
    if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8)
    if (left < 8) left = 8
    const popH = 340
    if (top + popH > window.innerHeight - 8) top = Math.max(8, r.top - popH - 6)
    setPos({ top, left, width })
  }

  useLayoutEffect(() => {
    if (!open) return
    place()
    const on = () => place()
    window.addEventListener('resize', on)
    window.addEventListener('scroll', on, true)
    return () => {
      window.removeEventListener('resize', on)
      window.removeEventListener('scroll', on, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node
      if (wrapRef.current?.contains(t) || popRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopImmediatePropagation()
      setOpen(false)
    }
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  const commit = (raw: string) => {
    const parsed = parseDeadline(raw)
    onChange(parsed || raw.trim())
  }

  const pick = (next: string) => {
    onChange(next)
    setText(next)
    setOpen(false)
  }

  const cells = monthCells(view.y, view.m, 1)
  const names = weekdayNames(1)
  const today = todayISO()

  return (
    <div className="date-field" ref={wrapRef}>
      <input
        className="input"
        name={name}
        value={text}
        placeholder={placeholder}
        autoComplete="off"
        inputMode="numeric"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onChange={(e) => {
          const next = e.target.value
          setText(next)
          const parsed = parseDeadline(next)
          if (parsed || next.trim() === '') onChange(parsed)
        }}
        onBlur={() => commit(text)}
      />
      <button
        type="button"
        className="btn-icon date-field-cal"
        aria-label="Open calendar"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="calendar" size={16} />
      </button>
      {open
        ? createPortal(
            <div ref={popRef} className="date-pop" role="dialog" aria-label="Choose date" style={{ top: pos.top, left: pos.left, width: pos.width }}>
              <div className="date-pop-head">
                <button
                  type="button"
                  className="btn-icon"
                  aria-label="Previous month"
                  onClick={() => setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }))}
                >
                  <Icon name="chevronL" size={16} />
                </button>
                <strong>{monthName(new Date(view.y, view.m, 1))}</strong>
                <button
                  type="button"
                  className="btn-icon"
                  aria-label="Next month"
                  onClick={() => setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }))}
                >
                  <Icon name="chevron" size={16} />
                </button>
              </div>
              <div className="date-pop-grid" aria-hidden>
                {names.map((n) => (
                  <span key={n} className="date-pop-dow">
                    {n.slice(0, 2)}
                  </span>
                ))}
              </div>
              <div className="date-pop-grid">
                {cells.map((c) => (
                  <button
                    key={c.iso}
                    type="button"
                    className="date-pop-day"
                    data-in={c.inMonth ? 'true' : 'false'}
                    data-on={c.iso === iso ? 'true' : 'false'}
                    data-today={c.iso === today ? 'true' : 'false'}
                    onClick={() => pick(c.iso)}
                  >
                    {c.date.getDate()}
                  </button>
                ))}
              </div>
              <div className="date-pop-foot">
                <button type="button" className="btn-ghost" onClick={() => pick(today)}>
                  Today
                </button>
                {value ? (
                  <button type="button" className="btn-ghost" onClick={() => pick('')}>
                    Clear
                  </button>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
