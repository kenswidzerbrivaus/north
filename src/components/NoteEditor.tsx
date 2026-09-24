import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { countWords, escapeHtml, sanitizeNoteHtml, stampNow, toEditorHtml } from '../lib/note-body'

const HIGHLIGHT = '#d4b45a'

type Marks = {
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  highlight: boolean
  h1: boolean
  h2: boolean
  h3: boolean
}

const EMPTY_MARKS: Marks = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  highlight: false,
  h1: false,
  h2: false,
  h3: false,
}

function qState(cmd: string) {
  try {
    return document.queryCommandState(cmd)
  } catch {
    return false
  }
}

function qValue(cmd: string) {
  try {
    return document.queryCommandValue(cmd).replace(/[<>]/g, '').toLowerCase()
  } catch {
    return ''
  }
}

function readMarks(): Marks {
  const block = qValue('formatBlock')
  const hi = qValue('hiliteColor').toLowerCase()
  const highlight = /d4b45a|212,\s*180,\s*90|180,\s*90/.test(hi)
  return {
    bold: qState('bold'),
    italic: qState('italic'),
    underline: qState('underline'),
    strike: qState('strikeThrough'),
    highlight,
    h1: block === 'h1',
    h2: block === 'h2',
    h3: block === 'h3',
  }
}

function run(cmd: string, value?: string) {
  document.execCommand(cmd, false, value)
}

function formatBlock(tag: string) {
  const current = qValue('formatBlock')
  const next = current === tag ? 'p' : tag
  run('formatBlock', `<${next}>`)
}

function Glyph({ d }: { d: string }) {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  )
}

export function NoteEditor({
  noteId,
  value,
  onChange,
  compact,
  tall,
  placeholder,
}: {
  noteId: string
  value: string
  onChange: (html: string) => void
  compact?: boolean
  tall?: boolean
  placeholder?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const rangeRef = useRef<Range | null>(null)
  const [marks, setMarks] = useState<Marks>(EMPTY_MARKS)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkVal, setLinkVal] = useState('https://')
  const [findOpen, setFindOpen] = useState(false)
  const [findVal, setFindVal] = useState('')
  const counts = countWords(value)

  const remember = () => {
    const sel = window.getSelection()
    if (sel && sel.rangeCount) rangeRef.current = sel.getRangeAt(0).cloneRange()
  }

  const restore = () => {
    const range = rangeRef.current
    const el = ref.current
    if (!range || !el) return
    el.focus()
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  }

  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const quiet = useRef(false)

  const emit = useCallback(() => {
    const el = ref.current
    if (!el || quiet.current) return
    el.querySelectorAll('ul.note-check li:not([data-check])').forEach((li) => li.setAttribute('data-check', '0'))
    el.dataset.empty = el.textContent?.trim() ? 'false' : 'true'
    onChangeRef.current(el.innerHTML)
    setMarks(readMarks())
  }, [])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    quiet.current = true
    document.execCommand('defaultParagraphSeparator', false, 'p')
    el.innerHTML = toEditorHtml(value)
    el.dataset.empty = el.textContent?.trim() ? 'false' : 'true'
    setLinkOpen(false)
    setFindOpen(false)
    setMarks(EMPTY_MARKS)
    const t = window.setTimeout(() => {
      quiet.current = false
    }, 0)
    return () => window.clearTimeout(t)
  }, [noteId])

  useEffect(() => {
    const onSel = () => {
      const el = ref.current
      if (!el) return
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) return
      if (!el.contains(sel.anchorNode)) return
      setMarks(readMarks())
    }
    document.addEventListener('selectionchange', onSel)
    return () => document.removeEventListener('selectionchange', onSel)
  }, [])

  const act = (fn: () => void) => {
    restore()
    ref.current?.focus()
    fn()
    emit()
  }

  const applyLink = () => {
    const href = linkVal.trim()
    if (!href) return
    restore()
    ref.current?.focus()
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) {
      run('insertHTML', `<a href="${escapeHtml(href)}">${escapeHtml(href)}</a>`)
    } else {
      run('createLink', href)
    }
    setLinkOpen(false)
    emit()
  }

  const insertCheck = () => {
    const sel = window.getSelection()
    const node = sel?.anchorNode
    const el = node instanceof Element ? node : node?.parentElement
    const list = el?.closest('ul, ol') as HTMLElement | null
    if (list?.classList.contains('note-check')) {
      list.classList.remove('note-check')
      list.querySelectorAll('li').forEach((li) => li.removeAttribute('data-check'))
      return
    }
    if (list) {
      if (list.tagName === 'OL') {
        const ul = document.createElement('ul')
        ul.className = 'note-check'
        ul.innerHTML = list.innerHTML
        list.replaceWith(ul)
        ul.querySelectorAll('li').forEach((li) => li.setAttribute('data-check', li.getAttribute('data-check') || '0'))
      } else {
        list.classList.add('note-check')
        list.querySelectorAll('li').forEach((li) => {
          if (!li.hasAttribute('data-check')) li.setAttribute('data-check', '0')
        })
      }
      return
    }
    run('insertHTML', '<ul class="note-check"><li data-check="0"><br></li></ul>')
  }

  const insertCode = () => {
    const sel = window.getSelection()
    const text = sel?.toString() ?? ''
    if (text && !text.includes('\n')) {
      run('insertHTML', `<code>${escapeHtml(text)}</code>`)
      return
    }
    formatBlock('pre')
  }

  const findNext = () => {
    const q = findVal.trim()
    if (!q) return
    const w = window as unknown as { find?: (a: string, b?: boolean, c?: boolean, d?: boolean) => boolean }
    w.find?.(q, false, false, true)
  }

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Tab') {
      e.preventDefault()
      act(() => run(e.shiftKey ? 'outdent' : 'indent'))
      return
    }
    const meta = e.metaKey || e.ctrlKey
    if (!meta) return
    const k = e.key.toLowerCase()
    if (k === 'b') {
      e.preventDefault()
      act(() => run('bold'))
    } else if (k === 'i') {
      e.preventDefault()
      act(() => run('italic'))
    } else if (k === 'u') {
      e.preventDefault()
      act(() => run('underline'))
    } else if (k === 'k') {
      e.preventDefault()
      remember()
      setFindOpen(false)
      setLinkOpen(true)
    } else if (k === 'f') {
      e.preventDefault()
      setLinkOpen(false)
      setFindOpen(true)
    } else if (e.shiftKey && k === 'x') {
      e.preventDefault()
      act(() => run('strikeThrough'))
    }
  }

  const hold = (e: PointerEvent) => {
    e.preventDefault()
    remember()
  }

  return (
    <div className={`note-write${compact ? ' is-compact' : ''}${tall ? ' is-tall' : ''}`}>
      <div className="note-tools" role="toolbar" aria-label="Writing tools">
        <Tool on={marks.bold} label="Bold" shortcut="⌘B" onPointerDown={hold} onClick={() => act(() => run('bold'))}>
          <b>B</b>
        </Tool>
        <Tool on={marks.italic} label="Italic" shortcut="⌘I" onPointerDown={hold} onClick={() => act(() => run('italic'))}>
          <i>I</i>
        </Tool>
        <Tool on={marks.underline} label="Underline" shortcut="⌘U" onPointerDown={hold} onClick={() => act(() => run('underline'))}>
          <span style={{ textDecoration: 'underline' }}>U</span>
        </Tool>
        <Tool on={marks.strike} label="Strikethrough" shortcut="⌘⇧X" onPointerDown={hold} onClick={() => act(() => run('strikeThrough'))}>
          <s>S</s>
        </Tool>
        <span className="note-sep" />
        <Tool on={marks.h1} label="Heading 1" onPointerDown={hold} onClick={() => act(() => formatBlock('h1'))}>
          H1
        </Tool>
        <Tool on={marks.h2} label="Heading 2" onPointerDown={hold} onClick={() => act(() => formatBlock('h2'))}>
          H2
        </Tool>
        <Tool on={marks.h3} label="Heading 3" onPointerDown={hold} onClick={() => act(() => formatBlock('h3'))}>
          H3
        </Tool>
        <span className="note-sep" />
        <Tool label="Bulleted list" onPointerDown={hold} onClick={() => act(() => run('insertUnorderedList'))}>
          <Glyph d="M8 6h13M8 12h13M8 18h13M4 6h.01M4 12h.01M4 18h.01" />
        </Tool>
        <Tool label="Numbered list" onPointerDown={hold} onClick={() => act(() => run('insertOrderedList'))}>
          <Glyph d="M10 6h11M10 12h11M10 18h11M3 6h3M3 12h3.5M3 18h3.5M3.5 6V5M5 18H3.2" />
        </Tool>
        <Tool label="Checklist" onPointerDown={hold} onClick={() => act(insertCheck)}>
          <Glyph d="M8 6h13M8 12h13M8 18h13M4 6l1.2 1.2L7 5.5M4 12l1.2 1.2L7 11.5M4 18l1.2 1.2L7 17.5" />
        </Tool>
        <Tool label="Indent" onPointerDown={hold} onClick={() => act(() => run('indent'))}>
          <Glyph d="M4 6h16M10 12h10M4 18h16M4 9l4 3-4 3" />
        </Tool>
        <Tool label="Outdent" onPointerDown={hold} onClick={() => act(() => run('outdent'))}>
          <Glyph d="M4 6h16M4 12h10M4 18h16M20 9l-4 3 4 3" />
        </Tool>
        <span className="note-sep" />
        <Tool label="Quote" onPointerDown={hold} onClick={() => act(() => formatBlock('blockquote'))}>
          <Glyph d="M7 8h5v5H9.5A2.5 2.5 0 0 0 12 15.5M14 8h5v5h-2.5A2.5 2.5 0 0 0 19 15.5" />
        </Tool>
        <Tool label="Code" onPointerDown={hold} onClick={() => act(insertCode)}>
          <Glyph d="M8 8l-4 4 4 4M16 8l4 4-4 4" />
        </Tool>
        <Tool
          on={marks.highlight}
          label="Highlight"
          onPointerDown={hold}
          onClick={() =>
            act(() => {
              const color = marks.highlight ? 'transparent' : HIGHLIGHT
              if (!document.execCommand('hiliteColor', false, color)) run('backColor', color)
            })
          }
        >
          <Glyph d="M4 20h16M7 15l8-8 3 3-8 8H7v-3z" />
        </Tool>
        <Tool
          on={linkOpen}
          label="Link"
          shortcut="⌘K"
          onPointerDown={hold}
          onClick={() => {
            remember()
            setFindOpen(false)
            setLinkOpen((v) => !v)
          }}
        >
          <Glyph d="M10 13a5 5 0 0 0 7.07.07l1.9-1.9a5 5 0 0 0-7.07-7.07l-1.1 1.1M14 11a5 5 0 0 0-7.07-.07l-1.9 1.9a5 5 0 1 0 7.07 7.07l1.1-1.1" />
        </Tool>
        <Tool label="Divider" onPointerDown={hold} onClick={() => act(() => run('insertHTML', '<hr>'))}>
          <Glyph d="M4 12h16" />
        </Tool>
        <Tool label="Insert date and time" onPointerDown={hold} onClick={() => act(() => run('insertHTML', escapeHtml(stampNow()) + ' '))}>
          <Glyph d="M5 6h14v14H5V6zm0 4h14M8 4v3m8-3v3" />
        </Tool>
        <span className="note-sep" />
        <Tool label="Undo" onPointerDown={hold} onClick={() => act(() => run('undo'))}>
          <Glyph d="M9 14L5 10l4-4M5 10h9a5 5 0 1 1 0 10H11" />
        </Tool>
        <Tool label="Redo" onPointerDown={hold} onClick={() => act(() => run('redo'))}>
          <Glyph d="M15 14l4-4-4-4M19 10h-9a5 5 0 1 0 0 10h3" />
        </Tool>
        <Tool
          on={findOpen}
          label="Find in note"
          shortcut="⌘F"
          onPointerDown={hold}
          onClick={() => {
            setLinkOpen(false)
            setFindOpen((v) => !v)
          }}
        >
          <Glyph d="M11 17a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm7 2-3.2-3.2" />
        </Tool>
        <Tool label="Clear formatting" onPointerDown={hold} onClick={() => act(() => run('removeFormat'))}>
          Tx
        </Tool>
      </div>

      {linkOpen ? (
        <div className="note-aux">
          <input
            className="input"
            value={linkVal}
            onChange={(e) => setLinkVal(e.target.value)}
            placeholder="https://"
            aria-label="Link URL"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                applyLink()
              }
              if (e.key === 'Escape') setLinkOpen(false)
            }}
            autoFocus
          />
          <button className="btn" type="button" onClick={applyLink}>
            Add
          </button>
          <button
            className="btn-ghost"
            type="button"
            onPointerDown={hold}
            onClick={() =>
              act(() => {
                run('unlink')
                setLinkOpen(false)
              })
            }
          >
            Unlink
          </button>
        </div>
      ) : null}

      {findOpen ? (
        <div className="note-aux">
          <input
            className="input"
            value={findVal}
            onChange={(e) => setFindVal(e.target.value)}
            placeholder="Find in this note"
            aria-label="Find in note"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                findNext()
              }
              if (e.key === 'Escape') setFindOpen(false)
            }}
            autoFocus
          />
          <button className="btn-ghost" type="button" onClick={findNext}>
            Next
          </button>
        </div>
      ) : null}

      <div
        ref={ref}
        className="note-body"
        contentEditable
        role="textbox"
        aria-multiline
        aria-label="Note body"
        data-placeholder={placeholder ?? 'Write — headings, lists, checks, quotes…'}
        spellCheck
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          const li = (e.target as HTMLElement).closest('li[data-check]') as HTMLElement | null
          if (!li || !ref.current?.contains(li)) return
          if (e.clientX - li.getBoundingClientRect().left > 26) return
          e.preventDefault()
          li.setAttribute('data-check', li.getAttribute('data-check') === '1' ? '0' : '1')
          emit()
        }}
        onPaste={(e) => {
          e.preventDefault()
          const html = e.clipboardData.getData('text/html')
          const text = e.clipboardData.getData('text/plain')
          const clean = html ? sanitizeNoteHtml(html) : escapeHtml(text).replace(/\r\n|\n/g, '<br>')
          run('insertHTML', clean || '')
          emit()
        }}
      />

      <div className="note-foot">
        <span>
          {counts.words} {counts.words === 1 ? 'word' : 'words'} · {counts.chars} characters
        </span>
        <span className="note-foot-hint">⌘B ⌘I ⌘U · ⌘K link · Tab indent</span>
      </div>
    </div>
  )
}

function Tool({
  on,
  label,
  shortcut,
  children,
  onClick,
  onPointerDown,
}: {
  on?: boolean
  label: string
  shortcut?: string
  children: ReactNode
  onClick: () => void
  onPointerDown: (e: PointerEvent<HTMLButtonElement>) => void
}) {
  return (
    <button
      type="button"
      className="note-tool"
      data-on={on ? 'true' : 'false'}
      aria-label={label}
      aria-pressed={on}
      title={shortcut ? `${label} ${shortcut}` : label}
      onPointerDown={onPointerDown}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
