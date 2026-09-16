import { useEffect, useState } from 'react'
import { Empty } from '../components/ui'
import { Icon } from '../icons'
import { formatMedium } from '../lib/dates'
import { hashParam } from '../lib/route'
import { useStore } from '../store'

export function Notes() {
  const { state, addNote, updateNote, deleteNote } = useStore()
  const [projectId, setProjectId] = useState(() => hashParam('project'))
  const [id, setId] = useState<string | null>(state.notes[0]?.id ?? null)
  const note = state.notes.find((n) => n.id === id)
  const [title, setTitle] = useState(note?.title ?? '')
  const [body, setBody] = useState(note?.body ?? '')

  useEffect(() => {
    const on = () => setProjectId(hashParam('project'))
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  useEffect(() => {
    setTitle(note?.title ?? '')
    setBody(note?.body ?? '')
  }, [note?.id, note?.title, note?.body])

  useEffect(() => {
    if (!id || !note || note.id !== id) return
    if (title === note.title && body === note.body) return
    const saveId = id
    const t = window.setTimeout(() => updateNote(saveId, { title, body }), 400)
    return () => window.clearTimeout(t)
  }, [body, id, note, title, updateNote])

  const sorted = [...state.notes]
    .filter((n) => !projectId || n.projectId === projectId)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt))

  return (
    <div>
      <header className="page-head">
        <div>
          <p className="kicker">Scratch, then keep</p>
          <h1>Notes</h1>
        </div>
        <button
          className="btn"
          onClick={() => {
            const nid = addNote('Untitled')
            if (projectId) updateNote(nid, { projectId })
            setId(nid)
          }}
        >
          <Icon name="plus" size={16} /> Note
        </button>
      </header>

      {sorted.length === 0 ? (
        <Empty title="Empty notebook" body="Write the thing you don’t want to lose." />
      ) : (
        <div className="split">
          <aside className="list-col">
            {sorted.map((n) => (
              <button key={n.id} className="note-row" data-on={n.id === id} onClick={() => setId(n.id)}>
                <span />
                <div>
                  <div className="task-title">{n.title || 'Untitled'}</div>
                  <div className="meta">
                    {n.pinned ? 'Pinned · ' : ''}
                    {formatMedium(n.updatedAt.slice(0, 10))}
                  </div>
                </div>
              </button>
            ))}
          </aside>
          {note ? (
            <section className="card note-editor">
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                <button className="btn-ghost" onClick={() => updateNote(note.id, { pinned: !note.pinned })}>
                  {note.pinned ? 'Unpin' : 'Pin'}
                </button>
                <select
                  className="select"
                  style={{ width: 'auto' }}
                  value={note.projectId ?? ''}
                  onChange={(e) => updateNote(note.id, { projectId: e.target.value || undefined })}
                >
                  <option value="">No project</option>
                  {state.projects.filter((p) => p.state !== 'archived').map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button className="btn-danger" onClick={() => { deleteNote(note.id); setId(sorted.find((n) => n.id !== note.id)?.id ?? null) }}>
                  <Icon name="trash" size={14} /> Delete
                </button>
              </div>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
              <textarea className="textarea" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write…" style={{ marginTop: 12 }} />
            </section>
          ) : null}
        </div>
      )}
    </div>
  )
}
