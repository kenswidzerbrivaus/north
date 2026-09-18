import { todayISO } from './dates'
import { exceptions, healthOf, pendingDecisions } from './project-engine'
import type { Route, State } from './types'

export const XAI_KEY = 'sepho.xai.key'
export const TRAVIS_MODEL = 'grok-4.6'

export type TravisAct =
  | { type: 'navigate'; route: Route; hash?: string }
  | { type: 'task'; title: string; due?: string }
  | { type: 'note'; title: string }
  | { type: 'event'; title: string; date: string }
  | { type: 'focus'; taskTitle?: string }
  | { type: 'pause' }

export function readXaiKey() {
  try {
    return localStorage.getItem(XAI_KEY)?.trim() || ''
  } catch {
    return ''
  }
}

export function writeXaiKey(key: string) {
  if (!key.trim()) localStorage.removeItem(XAI_KEY)
  else localStorage.setItem(XAI_KEY, key.trim())
}

export function travisSnapshot(state: State) {
  const today = todayISO()
  const hour = new Date().getHours()
  const name = state.settings.name.trim() || 'sir'
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const decisions = pendingDecisions(state.projectDecisions).slice(0, 5).map((d) => d.title)
  const attn = exceptions(state).slice(0, 5).map((e) => `${e.title}: ${e.detail}`)
  const goals = state.goals.filter((g) => g.status === 'active').map((g) => g.title)
  const projects = state.projects
    .filter((p) => p.state === 'active' || p.state === 'blocked')
    .map((p) => {
      const h = healthOf(
        p,
        state.milestones.filter((m) => m.projectId === p.id),
        state.blockers.filter((b) => b.projectId === p.id && !b.resolvedAt),
        state.projectDecisions.filter((d) => d.projectId === p.id),
      )
      return `${p.name} [${h.replace('_', ' ')}]`
    })
  const open = state.tasks.filter((t) => !t.completed && t.due === today).slice(0, 8).map((t) => t.title)
  const waiting = state.waitingOnItems.filter((w) => w.status === 'open' || w.status === 'overdue').slice(0, 4)
  return {
    greet: `${greet}, ${name}.`,
    name,
    today,
    decisions,
    attn,
    goals,
    projects,
    open,
    waiting: waiting.map((w) => `${w.person}: ${w.deliverable}`),
  }
}

export function travisBrief(state: State) {
  const s = travisSnapshot(state)
  const bits: string[] = [s.greet]
  if (s.decisions.length) bits.push(`${s.decisions.length} decision${s.decisions.length === 1 ? '' : 's'} require you.`)
  if (s.attn.length) bits.push(`${s.attn[0]}`)
  else if (s.projects.find((p) => /at risk|critical|blocked/i.test(p))) bits.push('One or more projects are off the happy path.')
  else bits.push('Board is clear of critical exceptions.')
  if (s.open[0]) bits.push(`Highest-value item today: ${s.open[0]}.`)
  return bits.join(' ')
}

const ROUTES: Record<string, Route> = {
  today: 'today',
  tasks: 'tasks',
  calendar: 'calendar',
  projects: 'projects',
  project: 'projects',
  habits: 'habits',
  habit: 'habits',
  focus: 'focus',
  timer: 'focus',
  notes: 'notes',
  note: 'notes',
  goals: 'goals',
  goal: 'goals',
  journal: 'journal',
  settings: 'settings',
}

export function localTravis(raw: string, state: State): { say: string; acts: TravisAct[] } {
  const q = raw
    .trim()
    .replace(/^(hey |ok |okay )?(travis|jarvis|sepho)[,:]?\s*/i, '')
    .trim()
    .toLowerCase()
  if (!q) return { say: travisBrief(state), acts: [] }

  if (/^(status|brief|report|update|what.?s (going on|the status)|how are we)\b/.test(q) || q === 'status') {
    return { say: travisBrief(state), acts: [] }
  }

  const nav = q.match(/^(open|go to|show|take me to|launch)\s+([a-z]+)/i)
  if (nav) {
    const key = nav[2]!.toLowerCase()
    const route = ROUTES[key]
    if (route) return { say: `Opening ${route}.`, acts: [{ type: 'navigate', route }] }
    const proj = state.projects.find((p) => p.name.toLowerCase().includes(key) || p.name.toLowerCase().includes(q.slice(nav[0].length).trim()))
    if (proj) return { say: `Opening ${proj.name}.`, acts: [{ type: 'navigate', route: 'projects', hash: `#/projects/${proj.id}` }] }
    const goal = state.goals.find((g) => g.title.toLowerCase().includes(q.replace(/^(open|go to|show)\s+/i, '')))
    if (goal) return { say: `Opening ${goal.title}.`, acts: [{ type: 'navigate', route: 'goals', hash: `#/goals/${goal.id}` }] }
  }

  const addTask = q.match(/^(add|create|new|make)\s+(a\s+)?task\s+(.+)/i) || q.match(/^remind me to (.+)/i)
  if (addTask) {
    const title = (addTask[3] || addTask[1] || '').replace(/\.$/, '').trim()
    if (title) return { say: `Task logged: ${title}.`, acts: [{ type: 'task', title, due: todayISO() }] }
  }

  const addNote = q.match(/^(add|create|new)\s+(a\s+)?note\s+(.+)/i)
  if (addNote) {
    const title = addNote[3]!.replace(/\.$/, '').trim()
    return { say: `Note captured.`, acts: [{ type: 'note', title }] }
  }

  const addEvent = q.match(/^(add|create|new|schedule)\s+(an?\s+)?(event|meeting)\s+(.+)/i)
  if (addEvent) {
    const title = addEvent[4]!.replace(/\.$/, '').trim()
    return { say: `On the calendar: ${title}.`, acts: [{ type: 'event', title, date: todayISO() }] }
  }

  if (/^(start|begin|enter)\s+(focus|timer)/.test(q) || q === 'focus' || q === 'suit up') {
    return { say: 'Focus engaged.', acts: [{ type: 'focus' }] }
  }
  if (/^(pause|stop|hold)\s+(focus|timer)/.test(q)) {
    return { say: 'Focus paused.', acts: [{ type: 'pause' }] }
  }

  if (/decision/.test(q)) {
    const s = travisSnapshot(state)
    return {
      say: s.decisions.length ? `Pending: ${s.decisions.join('; ')}.` : 'No executive decisions waiting.',
      acts: s.decisions.length ? [{ type: 'navigate', route: 'today' }] : [],
    }
  }

  const s = travisSnapshot(state)
  return {
    say: `I heard “${raw.trim()}.” I can brief you, open a module, log a task, or start focus. ${s.open[0] ? `Otherwise I recommend: ${s.open[0]}.` : 'Board is quiet.'}`,
    acts: [],
  }
}

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'navigate',
      description: 'Open a Sepho module or a specific project/goal.',
      parameters: {
        type: 'object',
        properties: {
          route: { type: 'string', enum: ['today', 'tasks', 'calendar', 'projects', 'habits', 'focus', 'notes', 'goals', 'journal', 'settings'] },
          hash: { type: 'string', description: 'Optional hash such as #/projects/id' },
        },
        required: ['route'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Create a task in Sepho.',
      parameters: {
        type: 'object',
        properties: { title: { type: 'string' }, due: { type: 'string', description: 'YYYY-MM-DD' } },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_note',
      parameters: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_event',
      parameters: {
        type: 'object',
        properties: { title: { type: 'string' }, date: { type: 'string' } },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'start_focus',
      parameters: { type: 'object', properties: { taskTitle: { type: 'string' } } },
    },
  },
  { type: 'function', function: { name: 'pause_focus', parameters: { type: 'object', properties: {} } } },
]

export async function grokTravis(utterance: string, state: State): Promise<{ say: string; acts: TravisAct[] } | null> {
  const key = readXaiKey()
  if (!key) return null
  const snap = travisSnapshot(state)
  const sys = `You are TRAVIS, Sepho's JARVIS-class chief of staff for ${snap.name}. Speak like JARVIS: concise, dry, competent, never cute. You RUN the operating system. Prefer tools over chat. Never invent data. Sepho snapshot: ${JSON.stringify(snap)}`
  const messages: Record<string, unknown>[] = [
    { role: 'system', content: sys },
    { role: 'user', content: utterance },
  ]
  const acts: TravisAct[] = []
  let say = ''
  for (let i = 0; i < 4; i++) {
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: TRAVIS_MODEL, messages, tools: TOOLS, tool_choice: 'auto' }),
    })
    if (!res.ok) throw new Error(`Grok ${res.status}`)
    const data = (await res.json()) as {
      choices?: { message?: { content?: string; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[]
    }
    const msg = data.choices?.[0]?.message
    if (!msg) break
    if (msg.tool_calls?.length) {
      messages.push({ role: 'assistant', content: msg.content ?? null, tool_calls: msg.tool_calls })
      for (const call of msg.tool_calls) {
        let args: Record<string, string> = {}
        try {
          args = JSON.parse(call.function.arguments || '{}') as Record<string, string>
        } catch {
          args = {}
        }
        const act = toolToAct(call.function.name, args)
        if (act) acts.push(act)
        messages.push({ role: 'tool', content: JSON.stringify({ ok: true, ...args }), tool_call_id: call.id } as never)
      }
      continue
    }
    say = (msg.content || '').trim()
    break
  }
  return { say: say || (acts.length ? 'Done.' : travisBrief(state)), acts }
}

function toolToAct(name: string, args: Record<string, string>): TravisAct | null {
  if (name === 'navigate' && args.route) return { type: 'navigate', route: args.route as Route, hash: args.hash }
  if (name === 'create_task' && args.title) return { type: 'task', title: args.title, due: args.due }
  if (name === 'create_note' && args.title) return { type: 'note', title: args.title }
  if (name === 'create_event' && args.title) return { type: 'event', title: args.title, date: args.date || todayISO() }
  if (name === 'start_focus') return { type: 'focus', taskTitle: args.taskTitle }
  if (name === 'pause_focus') return { type: 'pause' }
  return null
}

export function pickTravisVoice() {
  const voices = window.speechSynthesis?.getVoices?.() ?? []
  return (
    voices.find((v) => /daniel|google uk english male|microsoft george|alex/i.test(v.name)) ??
    voices.find((v) => v.lang.toLowerCase().startsWith('en-gb')) ??
    voices.find((v) => v.lang.toLowerCase().startsWith('en')) ??
    null
  )
}

export function travisSpeak(text: string, enabled: boolean) {
  if (!enabled || !text || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  const voice = pickTravisVoice()
  if (voice) u.voice = voice
  u.rate = 1.04
  u.pitch = 0.9
  window.speechSynthesis.speak(u)
}
