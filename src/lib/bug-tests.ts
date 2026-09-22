import assert from 'node:assert/strict'
import { test } from 'node:test'
import { eventIsDone } from './cal-done'
import { sephoCopy } from './rebrand'
import { layoutTimedEvents, nowLineTop, nowMinutes } from './cal-layout'
import { matchLinkedTask } from './cal-sync'
import { parseDeadline, stampTime } from './dates'
import { summarizeProjectDraft } from './drafts'
import { fromGoogleEvent, toGoogleBody } from './google-calendar'
import { metricNumber } from './goal-engine'
import { daysLeft, depsReady, parseMilestoneLines } from './project-engine'
import { mergeStates } from './cloud-merge'
import { cloudAction } from './sync-policy'
import { countWords, escapeHtml, looksLikeHtml, plainPreview, sanitizeNoteHtml, toEditorHtml } from './note-body'
import type { CalEvent, ProjectMilestone, Task } from './types'

test('cloud: unsaved local never overwrites cloud', () => {
  assert.equal(cloudAction(0, 1000), 'pull')
  assert.equal(cloudAction(0, null), 'push')
  assert.equal(cloudAction(500, 1000), 'pull')
  assert.equal(cloudAction(2000, 1000), 'push')
  assert.equal(cloudAction(1000, 1000), 'noop')
  assert.equal(cloudAction(0, 0), 'push')
})

test('cloud: newer remote always wins when opening the other device', () => {
  assert.equal(cloudAction(1_700_000_000_000, 1_700_000_000_500), 'pull')
})

test('cloud merge keeps tasks from both devices', () => {
  const local = {
    savedAt: 2,
    tasks: [{ id: 'a', title: 'Phone', notes: '', listId: 'inbox', completed: true, priority: 0, createdAt: 't', updatedAt: '2026-09-21T12:00:00', subtasks: [] }],
    events: [],
    lists: [],
    habits: [],
    habitLogs: [],
    notes: [],
    goals: [],
    journal: [],
    sessions: [],
    settings: { googleClientId: 'local' },
    projects: [],
    milestones: [],
    workstreams: [],
    projectDecisions: [],
    blockers: [],
    waitingOnItems: [],
    projectActivity: [],
    goalCycles: [],
    goalCheckpoints: [],
    goalMovers: [],
    goalReviews: [],
    envActions: [],
    northStars: [],
    version: 1 as const,
  }
  const remote = {
    ...local,
    savedAt: 1,
    tasks: [{ id: 'b', title: 'Web', notes: '', listId: 'inbox', completed: false, priority: 0, createdAt: 't', updatedAt: '2026-09-21T11:00:00', subtasks: [] }],
    settings: { googleClientId: 'remote' },
  }
  const merged = mergeStates(local as never, remote as never)
  assert.equal(merged.tasks.length, 2)
  assert.ok(merged.tasks.some((t) => t.id === 'a' && t.completed))
  assert.ok(merged.tasks.some((t) => t.id === 'b'))
  assert.equal(merged.settings.googleClientId, 'local')
})

test('cloud merge keeps notes, goals, and projects from both devices', () => {
  const empty = {
    savedAt: 1,
    tasks: [],
    events: [],
    lists: [],
    habits: [],
    habitLogs: [],
    notes: [],
    goals: [],
    journal: [],
    sessions: [],
    settings: { googleClientId: '' },
    projects: [],
    milestones: [],
    workstreams: [],
    projectDecisions: [],
    blockers: [],
    waitingOnItems: [],
    projectActivity: [],
    goalCycles: [],
    goalCheckpoints: [],
    goalMovers: [],
    goalReviews: [],
    envActions: [],
    northStars: [],
    version: 1 as const,
  }
  const local = {
    ...empty,
    savedAt: 20,
    notes: [{ id: 'n1', title: 'Phone note', body: 'x', pinned: false, createdAt: 't', updatedAt: '2026-09-21T12:00:00' }],
    goals: [{ id: 'g1', title: 'Phone goal', notes: '', progress: 2, status: 'active' as const, createdAt: 't', updatedAt: '2026-09-21T12:00:00' }],
    projects: [{ id: 'p1', name: 'Phone project', company: '', owner: '', objective: '', definitionOfDone: '', successMetric: '', why: '', constraints: '', problem: '', desiredOutcome: '', assumptions: '', killPivot: '', state: 'active' as const, priority: 0, deadline: '', createdAt: 't', updatedAt: '2026-09-21T12:00:00' }],
  }
  const remote = {
    ...empty,
    savedAt: 10,
    notes: [{ id: 'n2', title: 'Web note', body: 'y', pinned: false, createdAt: 't', updatedAt: '2026-09-21T11:00:00' }],
    goals: [{ id: 'g1', title: 'Old goal', notes: '', progress: 0, status: 'active' as const, createdAt: 't', updatedAt: '2026-09-21T10:00:00' }],
    projects: [{ id: 'p2', name: 'Web project', company: '', owner: '', objective: '', definitionOfDone: '', successMetric: '', why: '', constraints: '', problem: '', desiredOutcome: '', assumptions: '', killPivot: '', state: 'active' as const, priority: 0, deadline: '', createdAt: 't', updatedAt: '2026-09-21T11:00:00' }],
  }
  const merged = mergeStates(local as never, remote as never)
  assert.equal(merged.notes.length, 2)
  assert.equal(merged.projects.length, 2)
  assert.equal(merged.goals.find((g) => g.id === 'g1')?.title, 'Phone goal')
})

test('google: iPhone time with seconds is valid RFC3339', () => {
  const body = toGoogleBody({
    title: 'Call',
    notes: '',
    date: '2026-09-17',
    start: '09:00:00',
    end: '10:30:00',
    allDay: false,
    location: '',
  })
  assert.equal(body.start?.dateTime, '2026-09-17T09:00:00')
  assert.equal(body.end?.dateTime, '2026-09-17T10:30:00')
  assert.equal(body.start?.date, null)
})

test('google: missing or equal end is bumped one hour', () => {
  const same = toGoogleBody({
    title: 'Block',
    notes: '',
    date: '2026-09-17',
    start: '09:00',
    end: '09:00',
    allDay: false,
    location: '',
  })
  assert.equal(same.end?.dateTime, '2026-09-17T10:00:00')
  const overnight = toGoogleBody({
    title: 'Late',
    notes: '',
    date: '2026-09-17',
    start: '23:30',
    end: '01:00',
    allDay: false,
    location: '',
  })
  assert.equal(overnight.end?.dateTime, '2026-09-18T01:00:00')
})

test('google: all-day uses exclusive end date', () => {
  const body = toGoogleBody({
    title: 'Day',
    notes: '',
    date: '2026-09-17',
    allDay: true,
    location: '',
  })
  assert.equal(body.start?.date, '2026-09-17')
  assert.equal(body.end?.date, '2026-09-18')
  assert.equal(body.start?.dateTime, null)
})

test('google: timed events round-trip local hours', () => {
  const [ev] = fromGoogleEvent({
    id: 'abc',
    summary: 'Meet',
    start: { dateTime: '2026-09-17T15:45:00' },
    end: { dateTime: '2026-09-17T16:15:00' },
  })
  assert.ok(ev)
  assert.equal(ev.allDay, false)
  assert.equal(ev.start, '15:45')
  assert.equal(ev.end, '16:15')
})

test('metricNumber uses times-count not concatenated digits', () => {
  assert.equal(metricNumber('praying 1 time daily'), 1)
  assert.equal(metricNumber('Pray 3 times daily and fast 3 days weekly'), 3)
  assert.equal(metricNumber('$82,000'), 82000)
})

test('dates: parseDeadline accepts several formats', () => {
  assert.equal(parseDeadline('2026-10-30'), '2026-10-30')
  assert.equal(parseDeadline('10/30/2026'), '2026-10-30')
  assert.equal(parseDeadline(''), '')
})

test('dates: stampTime strips seconds for time inputs', () => {
  assert.equal(stampTime('09:00'), '09:00')
  assert.equal(stampTime('9:05:00'), '09:05')
  assert.equal(stampTime(''), undefined)
})

test('calendar: google task still matches after a time or date edit', () => {
  const tasks = [
    task({ id: 't1', title: 'Standup', googleId: 'g1', eventId: 'e-local', due: '2026-09-20', dueTime: '09:00' }),
    task({ id: 't2', title: 'Standup', googleId: 'g2', eventId: 'gcal:g2', due: '2026-09-20', dueTime: '10:00' }),
  ]
  const moved = ev({ id: 'gcal:g1', title: 'Standup', date: '2026-09-21', start: '11:00', googleId: 'g1' })
  assert.equal(matchLinkedTask(tasks, moved)?.id, 't1')
  assert.equal(matchLinkedTask(tasks, ev({ id: 'gcal:g2', title: 'Standup', date: '2026-09-20', googleId: 'g2' }))?.id, 't2')
})

test('project draft: owner-only is empty; named form can park', () => {
  assert.equal(summarizeProjectDraft({ form: { owner: 'Kens' } }, 'Kens'), null)
  assert.equal(summarizeProjectDraft({ form: { name: '', owner: 'Kens' }, steps: [{ name: '', date: '' }] }, 'Kens'), null)
  assert.deepEqual(summarizeProjectDraft({ form: { name: 'Fleet', owner: 'Kens' } }, 'Kens'), { name: 'Fleet' })
  assert.deepEqual(summarizeProjectDraft({ form: { owner: 'Kens' }, steps: [{ name: 'Secure Financing', date: '2026-10-30' }] }, 'Kens'), {
    name: 'Untitled project',
  })
})

test('milestones: parse lines with dates', () => {
  const rows = parseMilestoneLines('Secure Financing — 2026-10-04\nPurchase Truck\n')
  assert.equal(rows.length, 2)
  assert.equal(rows[0]?.name, 'Secure Financing')
  assert.equal(rows[0]?.plannedEnd, '2026-10-04')
  assert.equal(rows[1]?.name, 'Purchase Truck')
})

test('critical path: depsReady', () => {
  const a: ProjectMilestone = {
    id: 'a',
    projectId: 'p',
    name: 'A',
    owner: 'K',
    status: 'complete',
    criticalPath: true,
    sortOrder: 0,
    notes: '',
    dependsOn: [],
  }
  const b: ProjectMilestone = { ...a, id: 'b', name: 'B', status: 'upcoming', sortOrder: 1, dependsOn: ['a'] }
  assert.equal(depsReady(b, [a, b]), true)
  assert.equal(depsReady(b, [{ ...a, status: 'current' }, b]), false)
})

test('daysLeft is calendar-day based', () => {
  assert.equal(daysLeft('2026-09-20', '2026-09-17'), 3)
  assert.equal(daysLeft('2026-09-17', '2026-09-17'), 0)
})

function task(partial: Partial<Task> & Pick<Task, 'id' | 'title'>): Task {
  return {
    notes: '',
    listId: 'calendar',
    completed: false,
    priority: 0,
    createdAt: '',
    updatedAt: '',
    subtasks: [],
    ...partial,
  }
}

function ev(partial: Partial<CalEvent> & Pick<CalEvent, 'id' | 'title' | 'date'>): CalEvent {
  return { notes: '', allDay: true, color: '#6ee7ff', location: '', ...partial }
}

test('rebrand: app name North becomes Sepho, north star stays', () => {
  assert.equal(sephoCopy('Welcome to North'), 'Welcome to Sepho')
  assert.equal(sephoCopy('Walk through North — tasks, calendar, habits, focus'), 'Walk through Sepho — tasks, calendar, habits, focus')
  assert.equal(sephoCopy('North star // Long-term goal'), 'North star // Long-term goal')
})

test('calendar done: same title same day only strikes the checked task', () => {
  const tasks = [
    task({ id: 't1', title: 'Call mom', completed: true, eventId: 'e1', due: '2026-09-20' }),
    task({ id: 't2', title: 'Call mom', completed: false, eventId: 'e2', due: '2026-09-20' }),
  ]
  assert.equal(eventIsDone(ev({ id: 'e1', title: 'Call mom', date: '2026-09-20' }), tasks), true)
  assert.equal(eventIsDone(ev({ id: 'e2', title: 'Call mom', date: '2026-09-20' }), tasks), false)
})

test('calendar done: unlinked event still matches a lone completed task by title', () => {
  const tasks = [task({ id: 't1', title: 'Call mom', completed: true, due: '2026-09-20' })]
  assert.equal(eventIsDone(ev({ id: 'orphan', title: 'Call mom', date: '2026-09-20' }), tasks), true)
  assert.equal(eventIsDone(ev({ id: 'other', title: 'Gym', date: '2026-09-20' }), tasks), false)
})

test('calendar overlapping blocks get side-by-side columns', () => {
  const ev = (id: string, start: string, end: string) => ({
    id,
    title: id,
    notes: '',
    date: '2026-09-19',
    start,
    end,
    allDay: false,
    color: '#0af',
    location: '',
  })
  const laid = layoutTimedEvents([ev('a', '09:00', '10:00'), ev('b', '09:30', '10:30'), ev('c', '11:00', '12:00')])
  const a = laid.find((x) => x.event.id === 'a')!
  const b = laid.find((x) => x.event.id === 'b')!
  const c = laid.find((x) => x.event.id === 'c')!
  assert.equal(a.cols, 2)
  assert.equal(b.cols, 2)
  assert.notEqual(a.col, b.col)
  assert.equal(c.cols, 1)
})

test('calendar now line sits at the current minute on the day grid', () => {
  const at = new Date(2026, 8, 22, 15, 17, 0)
  assert.equal(nowMinutes(at), 15 * 60 + 17)
  assert.equal(nowLineTop(60, at), 15 * 60 + 17)
  assert.equal(nowLineTop(56, new Date(2026, 8, 22, 0, 0, 0)), 0)
  assert.equal(nowLineTop(56, new Date(2026, 8, 22, 12, 0, 0)), 12 * 56)
})

test('note body wraps plain text and keeps html', () => {
  assert.equal(looksLikeHtml('<p>Hi</p>'), true)
  assert.equal(looksLikeHtml('just text < 3'), false)
  assert.equal(toEditorHtml(''), '<p><br></p>')
  assert.match(toEditorHtml('hello\n\nworld'), /<p>hello<\/p>/)
  assert.match(toEditorHtml('hello\nworld'), /hello<br>world/)
  assert.equal(toEditorHtml('<h1>A</h1>'), '<h1>A</h1>')
  assert.equal(plainPreview('<p>Hello <b>world</b></p>'), 'Hello world')
  assert.equal(countWords('one two three').words, 3)
  assert.equal(countWords('<p></p>').words, 0)
  assert.equal(escapeHtml('<x>'), '&lt;x&gt;')
})

test('note sanitize strips scripts without executing', () => {
  const out = sanitizeNoteHtml('ok<script>alert(1)</script><b>hi</b>')
  assert.equal(out.includes('script'), false)
  assert.equal(out.includes('alert'), false)
})
