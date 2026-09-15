import { useEffect, type ReactNode } from 'react'
import { Icon } from '../icons'

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-wide={wide ? 'true' : 'false'}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <h2>{title}</h2>
          <button className="btn-icon" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <p className="kicker">Quiet for now</p>
      <h3>{title}</h3>
      <p className="muted">{body}</p>
      {action}
    </div>
  )
}

export function Check({ on, onClick, label }: { on: boolean; onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      className="check"
      data-on={on ? 'true' : 'false'}
      onClick={onClick}
      aria-pressed={on}
      aria-label={label ?? (on ? 'Completed' : 'Mark complete')}
    >
      {on ? <Icon name="check" size={12} /> : null}
    </button>
  )
}

export function ColorDots({
  value,
  onChange,
  colors,
}: {
  value: string
  onChange: (c: string) => void
  colors: string[]
}) {
  return (
    <div className="color-dots">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          className="color-dot"
          data-on={value === c ? 'true' : 'false'}
          style={{ background: c }}
          onClick={() => onChange(c)}
          aria-label={`Color ${c}`}
        />
      ))}
    </div>
  )
}
