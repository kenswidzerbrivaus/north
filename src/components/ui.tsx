import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../icons'

export function Modal({
  title,
  onClose,
  children,
  foot,
  wide,
  persist,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  foot?: ReactNode
  wide?: boolean
  persist?: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const vv = window.visualViewport
    const apply = () => {
      if (!vv) return
      document.documentElement.style.setProperty('--vv-top', `${vv.offsetTop}px`)
      document.documentElement.style.setProperty('--vvh', `${vv.height}px`)
    }
    vv?.addEventListener('resize', apply)
    vv?.addEventListener('scroll', apply)
    apply()
    return () => {
      window.removeEventListener('keydown', onKey)
      vv?.removeEventListener('resize', apply)
      vv?.removeEventListener('scroll', apply)
      document.documentElement.style.removeProperty('--vv-top')
      document.documentElement.style.removeProperty('--vvh')
    }
  }, [onClose])

  const node = (
    <div className="modal-backdrop" onMouseDown={persist ? undefined : onClose}>
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
        <div className="modal-body">{children}</div>
        {foot ? <footer className="modal-foot">{foot}</footer> : null}
      </div>
    </div>
  )
  return createPortal(node, document.body)
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
