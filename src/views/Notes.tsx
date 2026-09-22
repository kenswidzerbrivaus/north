import { useEffect, useRef, useState } from 'react'
import { NoteEditor } from '../components/NoteEditor'
import { Empty } from '../components/ui'
import { Icon } from '../icons'
import { formatMedium } from '../lib/dates'
import { plainPreview } from '../lib/note-body'
import { hashParam } from '../lib/route'
import { useStore } from '../store'
import type { Note } from '../lib/types'

export function Notes() {
  const { state, addNote, updateNote, deleteNote } = useStore()
  const [projectId, setProjectId] = useState(() => hashParam('project'))
  const [goalId, setGoalId] = useState(() => hashParam('goal'))
  const [id, setId] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const note = state.notes.find((n) => n.id === id)
  const close = () => setId(null)

  useEffect(() => {
    const on = () => {
      setProjectId(hashParam('project'))
      setGoalId(hashParam('goal'))
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  const needle = q.trim().toLowerCase()
  const sorted = [...state.notes]
    .filter((n) => (!projectId || n.projectId === projectId) && (!goalId || n.goalId === goalId))
    .filter((n) => {
      if (!needle) return true
      return n.title.toLowerCase().includes(needle) || plainPreview(n.body, 400).toLowerCase().includes(needle)
    })
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt))

  const create = () => {
    const nid = addNote('Untitled')
    if (projectId) updateNote(nid, { projectId })
    if (goalId) updateNote(nid, { goalId })
    setId(nid)
  }

  return (
    <div className={`notes-page${note ? ' is-writing' : ''}`}>
      <header className="page-head page-head-route">
        <div>
          <p className="kicker">Scratch, then keep</p>
          <h1>Notes</h1>
        </div>
        <button className="btn" type="button" onClick={create}>
          <Icon name="plus" size={16} /> Note
        </button>
      </header>

      {state.notes.length === 0 && !note ? (
        <Empty title="Empty notebook" body="Write the thing you don’t want to lose." />
      ) : (
        <div className={`split${note ? ' is-note-open' : ''}`}>
          <aside className="list-col">
            <input
              className="input note-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search notes"
              aria-label="Search notes"
            />
            {sorted.length === 0 ? <p className="muted">No matches.</p> : null}
            {sorted.map((n) => (
              <button key={n.id} className="note-row" data-on={n.id === id} onClick={() => setId(n.id)}>
                <span className="note-pin" data-on={n.pinned ? 'true' : 'false'} />
                <div>
                  <div className="task-title">{n.title || 'Untitled'}</div>
                  <div className="meta">
                    {plainPreview(n.body) || formatMedium(n.updatedAt.slice(0, 10))}
                  </div>
                </div>
              </button>
            ))}
          </aside>
          {note ? (
            <OpenNote
              key={note.id}
              note={note}
              onClose={close}
              onOpen={setId}
              onDelete={() => {
                deleteNote(note.id)
                close()
              }}
            />
          ) : (
            <section className="card note-editor note-editor-empty">
              <p className="muted">Open a note to write, or create one.</p>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function OpenNote({
  note,
  onClose,
  onDelete,
  onOpen,
}: {
  note: Note
  onClose: () => void
  onDelete: () => void
  onOpen: (id: string) => void
}) {
  const { state, addNote, updateNote } = useStore()
  const [title, setTitle] = useState(note.title)
  const [body, setBody] = useState(note.body)
  const draft = useRef({ title, body })
  draft.current = { title, body }

  const flush = () => {
    const d = draft.current
    if (d.title === note.title && d.body === note.body) return
    updateNote(note.id, { title: d.title, body: d.body })
  }
  const flushRef = useRef(flush)
  flushRef.current = flush

  useEffect(() => {
    if (title === note.title && body === note.body) return
    const t = window.setTimeout(() => updateNote(note.id, { title, body }), 400)
    return () => window.clearTimeout(t)
  }, [body, note.body, note.id, note.title, title, updateNote])

  useEffect(() => () => flushRef.current(), [note.id])

  return (
    <section className="card note-editor">
      <div className="note-editor-bar">
        <button
          className="btn-ghost"
          type="button"
          onClick={() => {
            flush()
            onClose()
          }}
        >
          <Icon name="chevronL" size={16} /> Done
        </button>
        <button className="btn-ghost" type="button" onClick={() => updateNote(note.id, { pinned: !note.pinned })}>
          {note.pinned ? 'Unpin' : 'Pin'}
        </button>
        <button
          className="btn-ghost"
          type="button"
          onClick={() => {
            updateNote(note.id, { title, body })
            const nid = addNote(title && title !== 'Untitled' ? `${title} copy` : 'Untitled')
            updateNote(nid, { body, projectId: note.projectId, goalId: note.goalId })
            onOpen(nid)
          }}
        >
          Duplicate
        </button>
        <button className="btn-danger" type="button" onClick={onDelete}>
          <Icon name="trash" size={14} /> Delete
        </button>
      </div>
      <div className="note-editor-meta">
        <select
          className="select"
          value={note.projectId ?? ''}
          onChange={(e) => updateNote(note.id, { projectId: e.target.value || undefined })}
          aria-label="Linked project"
        >
          <option value="">No project</option>
          {state.projects.filter((p) => p.state !== 'archived').map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          className="select"
          value={note.goalId ?? ''}
          onChange={(e) => updateNote(note.id, { goalId: e.target.value || undefined })}
          aria-label="Linked goal"
        >
          <option value="">No goal</option>
          {state.goals.filter((g) => g.status !== 'done').map((g) => (
            <option key={g.id} value={g.id}>
              {g.title}
            </option>
          ))}
        </select>
      </div>
      <input
        className="note-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        aria-label="Note title"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            document.querySelector<HTMLElement>('.note-body')?.focus()
          }
        }}
      />
      <NoteEditor noteId={note.id} value={body} onChange={setBody} />
    </section>
  )
}
