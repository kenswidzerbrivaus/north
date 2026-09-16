import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { nowISO } from './lib/id'
import { notify, requestNotify, startAlarm, stopAlarm, warmAudio } from './lib/sound'
import type { TimerMode } from './lib/types'
import { useStore } from './store'

type Live = {
  mode: TimerMode
  running: boolean
  remaining: number
  total: number
  taskId?: string
  rounds: number
}

type Alert = { finished: TimerMode; next: TimerMode }

type TimerApi = Live & {
  start: () => void
  pause: () => void
  reset: () => void
  skip: () => void
  setMode: (mode: TimerMode) => void
  setTaskId: (id?: string) => void
  alert: Alert | null
  dismissAlert: () => void
}

const TimerTickCtx = createContext(0)
const TimerApiCtx = createContext<Omit<TimerApi, 'remaining'> | null>(null)

function minutesFor(mode: TimerMode, s: { focusMinutes: number; shortBreak: number; longBreak: number }) {
  if (mode === 'focus') return s.focusMinutes
  if (mode === 'short') return s.shortBreak
  return s.longBreak
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const { state, logSession } = useStore()
  const settings = state.settings
  const [mode, setModeState] = useState<TimerMode>('focus')
  const [running, setRunning] = useState(false)
  const [remaining, setRemaining] = useState(settings.focusMinutes * 60)
  const [total, setTotal] = useState(settings.focusMinutes * 60)
  const [taskId, setTaskId] = useState<string | undefined>()
  const [rounds, setRounds] = useState(0)
  const [alert, setAlert] = useState<Alert | null>(null)
  const endsAt = useRef<number | null>(null)
  const startedAt = useRef<string | null>(null)
  const completing = useRef(false)
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  const applyMode = useCallback(
    (next: TimerMode, autoStart = false) => {
      const secs = minutesFor(next, settingsRef.current) * 60
      setModeState(next)
      setTotal(secs)
      setRemaining(secs)
      setRunning(autoStart)
      endsAt.current = autoStart ? Date.now() + secs * 1000 : null
      startedAt.current = autoStart ? nowISO() : null
    },
    [],
  )

  useEffect(() => {
    if (running) return
    const secs = minutesFor(mode, settings) * 60
    setTotal(secs)
    setRemaining(secs)
  }, [settings.focusMinutes, settings.shortBreak, settings.longBreak, mode, running])

  const complete = useCallback(() => {
    if (completing.current) return
    completing.current = true
    const s = settingsRef.current
    const elapsed = total
    logSession({
      mode,
      seconds: Math.max(elapsed, 1),
      startedAt: startedAt.current ?? nowISO(),
      endedAt: nowISO(),
      taskId,
      completed: true,
    })
    const next: TimerMode =
      mode === 'focus' ? ((rounds + 1) % s.roundsUntilLong === 0 ? 'long' : 'short') : 'focus'
    if (mode === 'focus') setRounds((n) => n + 1)
    applyMode(next, mode === 'focus' ? s.autoBreaks : false)
    setAlert({ finished: mode, next })
    if (s.sound) startAlarm()
    const label = mode === 'focus' ? 'Focus session complete' : 'Break over'
    notify(label, mode === 'focus' ? 'Time for a pause.' : 'Ready when you are.')
    window.setTimeout(() => {
      completing.current = false
    }, 400)
  }, [applyMode, logSession, mode, rounds, taskId, total])

  useEffect(() => {
    if (!running) return
    const tick = () => {
      const left = Math.max(0, Math.ceil(((endsAt.current ?? Date.now()) - Date.now()) / 1000))
      setRemaining(left)
      if (left <= 0) {
        setRunning(false)
        endsAt.current = null
        complete()
      }
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [running, complete])

  const dismissAlert = useCallback(() => {
    stopAlarm()
    setAlert(null)
  }, [])

  const start = useCallback(() => {
    if (remaining <= 0) return
    stopAlarm()
    setAlert(null)
    warmAudio()
    requestNotify()
    endsAt.current = Date.now() + remaining * 1000
    if (!startedAt.current) startedAt.current = nowISO()
    setRunning(true)
  }, [remaining])

  const pause = useCallback(() => {
    if (endsAt.current) {
      setRemaining(Math.max(0, Math.ceil((endsAt.current - Date.now()) / 1000)))
    }
    endsAt.current = null
    setRunning(false)
  }, [])

  const reset = useCallback(() => {
    stopAlarm()
    setAlert(null)
    applyMode(mode, false)
  }, [applyMode, mode])

  const skip = useCallback(() => {
    stopAlarm()
    setAlert(null)
    setRunning(false)
    if (mode === 'focus') {
      const next: TimerMode = (rounds + 1) % settingsRef.current.roundsUntilLong === 0 ? 'long' : 'short'
      setRounds((r) => r + 1)
      applyMode(next, false)
    } else {
      applyMode('focus', false)
    }
  }, [applyMode, mode, rounds])

  const setMode = useCallback(
    (next: TimerMode) => {
      applyMode(next, false)
    },
    [applyMode],
  )

  const api = useMemo(
    () => ({
      mode,
      running,
      total,
      taskId,
      rounds,
      start,
      pause,
      reset,
      skip,
      setMode,
      setTaskId,
      alert,
      dismissAlert,
    }),
    [alert, dismissAlert, mode, pause, reset, rounds, running, setMode, skip, start, taskId, total],
  )

  return (
    <TimerApiCtx.Provider value={api}>
      <TimerTickCtx.Provider value={remaining}>{children}</TimerTickCtx.Provider>
    </TimerApiCtx.Provider>
  )
}

export function useTimer() {
  const api = useContext(TimerApiCtx)
  const remaining = useContext(TimerTickCtx)
  if (!api) throw new Error('useTimer must be used within TimerProvider')
  return { ...api, remaining }
}

export function useTimerControls() {
  const api = useContext(TimerApiCtx)
  if (!api) throw new Error('useTimerControls must be used within TimerProvider')
  return api
}

export function formatRemain(secs: number) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
