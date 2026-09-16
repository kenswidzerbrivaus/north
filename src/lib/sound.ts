let ctx: AudioContext | null = null
let alarmLoop = 0
let titleLoop = 0
let originalTitle = ''
let activeNote: Notification | null = null

export function warmAudio() {
  try {
    ctx = ctx ?? new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    /* audio optional */
  }
}

function burst() {
  if (!ctx) return
  const now = ctx.currentTime
  ;[
    { freq: 880, at: 0 },
    { freq: 698, at: 0.18 },
    { freq: 880, at: 0.36 },
  ].forEach(({ freq, at }) => {
    const osc = ctx!.createOscillator()
    const gain = ctx!.createGain()
    osc.type = 'square'
    osc.frequency.value = freq
    const t = now + at
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.22, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28)
    osc.connect(gain).connect(ctx!.destination)
    osc.start(t)
    osc.stop(t + 0.3)
  })
}

export function startAlarm() {
  stopAlarm()
  warmAudio()
  burst()
  alarmLoop = window.setInterval(burst, 1400)
  originalTitle = document.title
  let on = false
  titleLoop = window.setInterval(() => {
    on = !on
    document.title = on ? 'TIME’S UP — Sepho' : originalTitle || 'Sepho'
  }, 700)
  try {
    navigator.vibrate?.([240, 120, 240, 120, 480])
  } catch {
    /* ignore */
  }
}

export function stopAlarm() {
  if (alarmLoop) window.clearInterval(alarmLoop)
  if (titleLoop) window.clearInterval(titleLoop)
  alarmLoop = 0
  titleLoop = 0
  if (originalTitle) document.title = originalTitle
  originalTitle = ''
  try {
    navigator.vibrate?.(0)
  } catch {
    /* ignore */
  }
  activeNote?.close()
  activeNote = null
}

export function notify(title: string, body: string) {
  if (typeof Notification === 'undefined') return
  if (Notification.permission !== 'granted') return
  try {
    activeNote?.close()
    activeNote = new Notification(title, {
      body,
      tag: 'north-timer',
      requireInteraction: true,
      silent: false,
    })
    activeNote.onclick = () => {
      window.focus()
      activeNote?.close()
    }
  } catch {
    /* notifications optional */
  }
}

export function requestNotify() {
  if (typeof Notification === 'undefined') return
  if (Notification.permission === 'default') void Notification.requestPermission()
}
