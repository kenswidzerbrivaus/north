import { useCallback, useEffect, useRef, useState } from 'react'
import { isTypingTarget, useRoute } from './lib/route'
import { todayISO } from './lib/dates'
import { grokTravis, localTravis, travisBrief, travisSpeak, type TravisAct } from './lib/travis'
import { useStore } from './store'
import { useTimer } from './timer'

type Recog = {
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((ev: { results: { [i: number]: { [j: number]: { transcript: string } }; length: number } }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  lang: string
  interimResults: boolean
  continuous: boolean
}

function makeRecog(): Recog | null {
  const C = (window as unknown as { SpeechRecognition?: new () => Recog; webkitSpeechRecognition?: new () => Recog }).SpeechRecognition
    || (window as unknown as { webkitSpeechRecognition?: new () => Recog }).webkitSpeechRecognition
  if (!C) return null
  const r = new C()
  r.lang = 'en-US'
  r.interimResults = false
  r.continuous = false
  return r
}

export function TravisHud() {
  const { state, addTask, addNote, addEvent } = useStore()
  const [, go] = useRoute()
  const timer = useTimer()
  const [open, setOpen] = useState(false)
  const [listening, setListening] = useState(false)
  const [busy, setBusy] = useState(false)
  const [line, setLine] = useState('')
  const [heard, setHeard] = useState('')
  const [input, setInput] = useState('')
  const recog = useRef<Recog | null>(null)
  const voice = state.settings.travisVoice !== false

  const runActs = useCallback(
    (acts: TravisAct[]) => {
      for (const a of acts) {
        if (a.type === 'navigate') {
          if (a.hash) location.hash = a.hash
          else go(a.route)
        } else if (a.type === 'task') addTask({ title: a.title, due: a.due || todayISO() })
        else if (a.type === 'note') addNote(a.title)
        else if (a.type === 'event') addEvent({ title: a.title, date: a.date || todayISO(), allDay: true })
        else if (a.type === 'focus') {
          if (a.taskTitle) {
            const t = state.tasks.find((x) => !x.completed && x.title.toLowerCase().includes(a.taskTitle!.toLowerCase()))
            if (t) timer.setTaskId(t.id)
          }
          timer.start()
          go('focus')
        } else if (a.type === 'pause') timer.pause()
      }
    },
    [addEvent, addNote, addTask, go, state.tasks, timer],
  )

  const handle = useCallback(
    async (utterance: string) => {
      const text = utterance.trim()
      if (!text) return
      setHeard(text)
      setBusy(true)
      setOpen(true)
      try {
        let out = localTravis(text, state)
        try {
          const grok = await grokTravis(text, state)
          if (grok) out = grok
        } catch {
          /* local stands in */
        }
        setLine(out.say)
        runActs(out.acts)
        const kind = await travisSpeak(out.say, voice)
        if (kind !== 'human' && kind !== 'off' && kind !== 'device') {
          setLine(`${out.say}\n\nVoice: ${kind}`)
        } else if (kind === 'device') {
          setLine(`${out.say}\n\nDevice voice. Paste an xAI key in Settings for Eve.`)
        }
      } finally {
        setBusy(false)
      }
    },
    [runActs, state, voice],
  )

  useEffect(() => {
    const key = `travis.greet.${todayISO()}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    setLine(travisBrief(state))
  }, [state])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (e.key.toLowerCase() === 'j' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        setOpen(true)
        listen()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const listen = () => {
    const r = recog.current ?? makeRecog()
    recog.current = r
    if (!r) {
      setOpen(true)
      setLine('Voice is unavailable on this browser. Type a command, sir.')
      return
    }
    r.onresult = (ev) => {
      const t = ev.results[ev.results.length - 1]?.[0]?.transcript ?? ''
      void handle(t)
    }
    r.onend = () => setListening(false)
    r.onerror = () => setListening(false)
    try {
      r.start()
      setListening(true)
      setOpen(true)
      setLine('Listening.')
    } catch {
      setListening(false)
    }
  }

  return (
    <div className={`travis ${open ? 'is-open' : ''} ${listening ? 'is-live' : ''}`}>
      <button
        className="travis-orb"
        aria-label="Sepho"
        onClick={() => {
          if (open && !listening) listen()
          else if (!open) {
            setOpen(true)
            listen()
          } else {
            recog.current?.stop()
            setListening(false)
            setOpen(false)
          }
        }}
      >
        <span className="travis-ring" />
        <span className="kicker">S</span>
      </button>
      {open ? (
        <div className="travis-panel hud-frame">
          <p className="board-label">Sepho // Online</p>
          {heard ? <p className="muted">You: {heard}</p> : null}
          <p className="board-brief">{busy ? 'Working…' : line || 'Online. Press J or speak.'}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!input.trim()) return
              const v = input
              setInput('')
              void handle(v)
            }}
          >
            <input
              className="input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Command Sepho…"
            />
          </form>
        </div>
      ) : null}
    </div>
  )
}
