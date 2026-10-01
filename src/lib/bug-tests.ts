import assert from 'node:assert/strict'
import { test } from 'node:test'
import { eventIsDone } from './cal-done'
import { sephoCopy } from './rebrand'
import { layoutTimedEvents, nowLineTop, nowMinutes } from './cal-layout'
import { matchCalEvents } from './cal-search'
import { collapseDuplicateTasks, matchLinkedTask } from './cal-sync'
import { localDay, parseDeadline, stampTime } from './dates'
import { normalizeState } from './normalize'
import { sortTasksChronological } from './task-sort'
import { summarizeProjectDraft } from './drafts'
import { fromGoogleEvent, toGoogleBody } from './google-calendar'
import { metricNumber } from './goal-engine'
import { collapseDuplicateHabits } from './habits'
import {
  applyMilestoneOrder,
  daysLeft,
  depsReady,
  dropMilestoneChain,
  isNextUp,
  isWorkingOn,
  labelState,
  migrateProjectFocusLimit,
  parseMilestoneLines,
} from './project-engine'
import { collapseDuplicateProjects } from './project-dupes'
import { mergeStates } from './cloud-merge'
import { cloudAction } from './sync-policy'
import { formatJournalArchive, journalHasWriting, pickJournalDraft } from './journal-draft'
import { countWords, escapeHtml, looksLikeHtml, plainPreview, sanitizeNoteHtml, toEditorHtml } from './note-body'
import type { CalEvent, ProjectMilestone, Task } from './types'
import {
  defaultAttention,
  detoxActive,
  evaluateGate,
  inWindow,
  mergeAttention,
  normalizeAttention,
  quietStreak,
} from './attention'

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

test('tasks: chronological order is due date then time, undated last', () => {
  const t = (id: string, extra: Partial<Task>): Task => ({
    id,
    title: id,
    notes: '',
    listId: 'inbox',
    completed: false,
    priority: 0,
    createdAt: extra.createdAt ?? '2026-09-01T00:00:00.000Z',
    updatedAt: 't',
    subtasks: [],
    ...extra,
  })
  const rows = sortTasksChronological([
    t('late', { due: '2026-10-02', dueTime: '09:00' }),
    t('early', { due: '2026-10-01', dueTime: '15:00' }),
    t('morning', { due: '2026-10-02', dueTime: '08:00' }),
    t('undated', { createdAt: '2026-09-10T00:00:00.000Z' }),
    t('allday', { due: '2026-10-01' }),
  ])
  assert.deepEqual(rows.map((r) => r.id), ['allday', 'early', 'morning', 'late', 'undated'])
})

test('dates: parseDeadline accepts several formats', () => {
  assert.equal(parseDeadline('2026-10-30'), '2026-10-30')
  assert.equal(parseDeadline('10/30/2026'), '2026-10-30')
  assert.equal(parseDeadline(''), '')
  assert.equal(parseDeadline('2026-10'), '')
  assert.equal(parseDeadline('2026-10-'), '')
})

test('dates: localDay uses the device calendar date not UTC slice', () => {
  assert.equal(localDay('2026-09-30'), '2026-09-30')
  const d = new Date(Date.UTC(2026, 9, 1, 3, 15, 0))
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  assert.equal(localDay(d.toISOString()), `${y}-${m}-${day}`)
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

test('projects: collapse same-name copies keeps the newest', () => {
  const blank = {
    version: 1 as const,
    savedAt: 1,
    lists: [],
    tasks: [
      {
        id: 't-old',
        title: 'Call bank',
        notes: '',
        listId: 'work',
        completed: false,
        priority: 0,
        createdAt: 't',
        updatedAt: '2026-09-20T10:00:00',
        subtasks: [],
        projectId: 'old',
        milestoneId: 'ms-old',
      },
    ],
    events: [],
    habits: [],
    habitLogs: [],
    notes: [{ id: 'n1', title: 'Note', body: 'x', pinned: false, createdAt: 't', updatedAt: 't', projectId: 'old' }],
    goals: [],
    journal: [],
    sessions: [],
    settings: { googleClientId: '' },
    projects: [
      {
        id: 'old',
        name: 'First Truck Operational',
        company: 'Brivaus Trucking',
        owner: 'K',
        objective: '',
        definitionOfDone: '',
        successMetric: '',
        why: '',
        constraints: '',
        problem: '',
        desiredOutcome: '',
        assumptions: '',
        killPivot: '',
        state: 'active' as const,
        priority: 0,
        deadline: '2026-10-30',
        createdAt: '2026-09-16T16:14:19.832Z',
        updatedAt: '2026-09-16T16:14:19.832Z',
      },
      {
        id: 'new',
        name: 'First Truck Operational',
        company: 'Brivaus Trucking',
        owner: 'K',
        objective: 'Put the truck on the road.',
        definitionOfDone: '',
        successMetric: '',
        why: '',
        constraints: '',
        problem: '',
        desiredOutcome: '',
        assumptions: '',
        killPivot: '',
        state: 'active' as const,
        priority: 0,
        deadline: '2026-10-30',
        createdAt: '2026-09-27T12:00:00.000Z',
        updatedAt: '2026-09-28T08:00:00.000Z',
      },
    ],
    milestones: [
      {
        id: 'ms-old',
        projectId: 'old',
        name: 'Secure Financing',
        owner: 'K',
        status: 'current' as const,
        criticalPath: true,
        sortOrder: 0,
        notes: '',
        dependsOn: [],
      },
      {
        id: 'ms-new',
        projectId: 'new',
        name: 'Secure Financing',
        owner: 'K',
        status: 'current' as const,
        criticalPath: true,
        sortOrder: 0,
        notes: '',
        dependsOn: [],
        updatedAt: '2026-09-28T08:00:00.000Z',
      },
    ],
    workstreams: [],
    projectDecisions: [],
    blockers: [],
    waitingOnItems: [],
    projectActivity: [{ id: 'a1', projectId: 'new', type: 'update', description: 'Edited path', createdAt: '2026-09-28T08:00:00.000Z' }],
    goalCycles: [],
    goalCheckpoints: [],
    goalMovers: [{ id: 'mv', goalId: 'g', rank: 0, entityType: 'project' as const, entityId: 'old' }],
    goalReviews: [],
    envActions: [],
    northStars: [],
  }
  const next = collapseDuplicateProjects(blank as never)
  assert.equal(next.projects.length, 1)
  assert.equal(next.projects[0]?.id, 'new')
  assert.equal(next.milestones.length, 1)
  assert.equal(next.milestones[0]?.id, 'ms-new')
  assert.equal(next.tasks[0]?.projectId, 'new')
  assert.equal(next.tasks[0]?.milestoneId, 'ms-new')
  assert.equal(next.notes[0]?.projectId, 'new')
  assert.equal(next.goalMovers[0]?.entityId, 'new')
  assert.equal(next.projectActivity.length, 1)
})

test('projects: different names are not collapsed', () => {
  const a = {
    id: 'a',
    name: 'Truck',
    company: '',
    owner: '',
    objective: '',
    definitionOfDone: '',
    successMetric: '',
    why: '',
    constraints: '',
    problem: '',
    desiredOutcome: '',
    assumptions: '',
    killPivot: '',
    state: 'active' as const,
    priority: 0,
    deadline: '',
    createdAt: 't',
    updatedAt: 't',
  }
  const state = {
    version: 1 as const,
    savedAt: 1,
    lists: [],
    tasks: [],
    events: [],
    habits: [],
    habitLogs: [],
    notes: [],
    goals: [],
    journal: [],
    sessions: [],
    settings: { googleClientId: '' },
    projects: [a, { ...a, id: 'b', name: 'Suncrest' }],
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
  }
  const next = collapseDuplicateProjects(state as never)
  assert.equal(next.projects.length, 2)
})

test('habits: collapse same-name daily systems keeps the logged copy', () => {
  const blank = {
    version: 1 as const,
    savedAt: 1,
    lists: [],
    tasks: [],
    events: [],
    habits: [
      { id: 'old', name: 'Read', color: '#fff', days: [] as number[], target: 1, archived: false, createdAt: '2026-09-01T00:00:00.000Z' },
      { id: 'new', name: 'Read', color: '#0ff', days: [1, 2, 3], target: 1, archived: false, createdAt: '2026-09-28T00:00:00.000Z' },
      { id: 'gym', name: 'Workout', color: '#f00', days: [] as number[], target: 1, archived: false, createdAt: 't' },
    ],
    habitLogs: [
      { habitId: 'old', date: '2026-09-20', count: 1 },
      { habitId: 'old', date: '2026-09-21', count: 1 },
      { habitId: 'new', date: '2026-09-21', count: 1 },
    ],
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
    goalMovers: [{ id: 'mv', goalId: 'g', rank: 0, entityType: 'habit' as const, entityId: 'new' }],
    goalReviews: [],
    envActions: [{ id: 'e', cycleId: 'c', kind: 'digital' as const, action: 'remove' as const, description: 'x', habitId: 'new', done: false }],
    northStars: [],
  }
  const next = collapseDuplicateHabits(blank as never)
  assert.equal(next.habits.filter((h) => h.name === 'Read').length, 1)
  assert.equal(next.habits.find((h) => h.name === 'Read')?.id, 'old')
  assert.equal(next.habits.some((h) => h.id === 'gym'), true)
  assert.equal(next.habitLogs.every((l) => l.habitId === 'old' || l.habitId === 'gym'), true)
  assert.equal(next.habitLogs.filter((l) => l.date === '2026-09-21').length, 1)
  assert.equal(next.goalMovers[0]?.entityId, 'old')
  assert.equal(next.envActions[0]?.habitId, 'old')
})

test('projects: working on vs next', () => {
  assert.equal(isWorkingOn({ state: 'active' }), true)
  assert.equal(isWorkingOn({ state: 'blocked' }), true)
  assert.equal(isWorkingOn({ state: 'backlog' }), false)
  assert.equal(isNextUp({ state: 'backlog' }), true)
  assert.equal(isNextUp({ state: 'active' }), false)
  assert.equal(labelState('active'), 'WORKING ON')
  assert.equal(labelState('backlog'), 'NEXT')
  assert.equal(labelState('blocked'), 'BLOCKED')
})

test('projects: legacy capacity 10 becomes 3', () => {
  assert.equal(migrateProjectFocusLimit(undefined), 3)
  assert.equal(migrateProjectFocusLimit(10), 3)
  assert.equal(migrateProjectFocusLimit(3), 3)
  assert.equal(migrateProjectFocusLimit(5), 5)
})

test('milestones: parse lines with dates', () => {
  const rows = parseMilestoneLines('Secure Financing — 2026-10-04\nPurchase Truck\n')
  assert.equal(rows.length, 2)
  assert.equal(rows[0]?.name, 'Secure Financing')
  assert.equal(rows[0]?.plannedEnd, '2026-10-04')
  assert.equal(rows[1]?.name, 'Purchase Truck')
})

test('critical path: reorder swaps two steps and rechains dependsOn', () => {
  const a: ProjectMilestone = {
    id: 'a',
    projectId: 'p',
    name: 'A',
    owner: 'K',
    status: 'current',
    criticalPath: true,
    sortOrder: 0,
    notes: '',
    dependsOn: [],
  }
  const b: ProjectMilestone = { ...a, id: 'b', name: 'B', status: 'upcoming', sortOrder: 1, dependsOn: ['a'] }
  const c: ProjectMilestone = { ...a, id: 'c', name: 'C', status: 'upcoming', sortOrder: 2, dependsOn: ['b'] }
  const next = applyMilestoneOrder([a, b, c], 'p', ['b', 'a', 'c'], 't')
  assert.ok(next)
  const ordered = [...next!].filter((m) => m.projectId === 'p').sort((x, y) => x.sortOrder - y.sortOrder)
  assert.deepEqual(ordered.map((m) => m.id), ['b', 'a', 'c'])
  assert.deepEqual(ordered[0]?.dependsOn, [])
  assert.deepEqual(ordered[1]?.dependsOn, ['b'])
  assert.deepEqual(ordered[2]?.dependsOn, ['a'])
})

test('critical path: reorder path only leaves off-path milestones in place', () => {
  const a: ProjectMilestone = {
    id: 'a',
    projectId: 'p',
    name: 'A',
    owner: 'K',
    status: 'current',
    criticalPath: true,
    sortOrder: 0,
    notes: '',
    dependsOn: [],
  }
  const side: ProjectMilestone = { ...a, id: 's', name: 'Side', criticalPath: false, sortOrder: 1, dependsOn: [] }
  const c: ProjectMilestone = { ...a, id: 'c', name: 'C', status: 'upcoming', sortOrder: 2, dependsOn: ['a'] }
  const next = applyMilestoneOrder([a, side, c], 'p', ['c', 'a'], 't')
  assert.ok(next)
  const ordered = [...next!].sort((x, y) => x.sortOrder - y.sortOrder)
  assert.deepEqual(ordered.map((m) => m.id), ['c', 's', 'a'])
  assert.equal(ordered[1]?.criticalPath, false)
})

test('critical path: drop a current step promotes the next and unlinks dependsOn', () => {
  const a: ProjectMilestone = {
    id: 'a',
    projectId: 'p',
    name: 'A',
    owner: 'K',
    status: 'current',
    criticalPath: true,
    sortOrder: 0,
    notes: '',
    dependsOn: [],
  }
  const b: ProjectMilestone = { ...a, id: 'b', name: 'B', status: 'upcoming', sortOrder: 1, dependsOn: ['a'] }
  const result = dropMilestoneChain([a, b], 'a', 't')
  assert.ok(result)
  assert.equal(result!.milestones.length, 1)
  assert.equal(result!.milestones[0]?.id, 'b')
  assert.equal(result!.milestones[0]?.status, 'current')
  assert.deepEqual(result!.milestones[0]?.dependsOn, [])
  assert.equal(result!.milestones[0]?.sortOrder, 0)
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

test('calendar done: two same-title events only strike the completed one', () => {
  const a = ev({ id: 'e1', title: 'Standup', date: '2026-09-24' })
  const b = ev({ id: 'e2', title: 'Standup', date: '2026-09-24' })
  const tasks = [task({ id: 't1', title: 'Standup', completed: true, eventId: 'e1', due: '2026-09-24' })]
  assert.equal(eventIsDone(a, tasks, [a, b]), true)
  assert.equal(eventIsDone(b, tasks, [a, b]), false)
  assert.equal(matchLinkedTask(tasks, b), undefined)
})

test('calendar done: same google id on different days stay independent', () => {
  const mon = ev({ id: 'gcal:series:2026-09-21', title: 'Standup', date: '2026-09-21', googleId: 'series' })
  const tue = ev({ id: 'gcal:series:2026-09-22', title: 'Standup', date: '2026-09-22', googleId: 'series' })
  const tasks = [task({ id: 't1', title: 'Standup', completed: true, googleId: 'series', due: '2026-09-21' })]
  assert.equal(eventIsDone(mon, tasks, [mon]), true)
  assert.equal(eventIsDone(tue, tasks, [tue]), false)
})

test('calendar task link matches google all-day ids and unlinked same-day title', () => {
  const linked = task({ id: 't1', title: 'Standup', googleId: 'abc', due: '2026-09-23' })
  assert.equal(matchLinkedTask([linked], ev({ id: 'gcal:abc:2026-09-23', title: 'Standup', date: '2026-09-23', googleId: 'abc' }))?.id, 't1')
  const local = task({ id: 't2', title: 'Walk', due: '2026-09-23' })
  assert.equal(matchLinkedTask([local], ev({ id: 'gcal:xyz', title: 'Walk', date: '2026-09-23', googleId: 'xyz' }))?.id, 't2')
  const taken = task({ id: 't3', title: 'Walk', eventId: 'e9', due: '2026-09-23' })
  assert.equal(matchLinkedTask([taken], ev({ id: 'gcal:zzz', title: 'Walk', date: '2026-09-23', googleId: 'zzz' })), undefined)
  const two = [
    task({ id: 'a', title: 'Call mom', eventId: 'e1', due: '2026-09-23' }),
    task({ id: 'b', title: 'Call mom', eventId: 'e2', due: '2026-09-23' }),
  ]
  assert.equal(matchLinkedTask(two, ev({ id: 'e1', title: 'Call mom', date: '2026-09-23' }))?.id, 'a')
  assert.equal(matchLinkedTask(two, ev({ id: 'e2', title: 'Call mom', date: '2026-09-23' }))?.id, 'b')
})

test('collapse duplicate tasks keeps two different events with the same title', () => {
  const collapsed = collapseDuplicateTasks([
    task({ id: 't1', title: 'Call mom', eventId: 'e1', due: '2026-09-23' }),
    task({ id: 't2', title: 'Call mom', eventId: 'e2', due: '2026-09-23' }),
    task({ id: 't3', title: 'Walk', eventId: 'e3', due: '2026-09-23' }),
    task({ id: 't4', title: 'Walk', due: '2026-09-23' }),
    task({ id: 't5', title: 'Gym', googleId: 'g1', due: '2026-09-23' }),
    task({ id: 't6', title: 'Gym', googleId: 'g1', due: '2026-09-23' }),
    task({ id: 't7', title: 'Gym', googleId: 'g1', due: '2026-09-24' }),
  ])
  const ids = collapsed.map((t) => t.id).sort()
  assert.deepEqual(ids, ['t1', 't2', 't3', 't5', 't7'])
  assert.equal(collapsed.find((t) => t.id === 't3')?.googleId, undefined)
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

test('calendar search ranks title matches and upcoming first', () => {
  const ev = (id: string, title: string, date: string, extra: Partial<CalEvent> = {}): CalEvent => ({
    id,
    title,
    notes: extra.notes ?? '',
    date,
    start: extra.start,
    end: extra.end,
    allDay: extra.allDay ?? !extra.start,
    color: '#6ee7ff',
    location: extra.location ?? '',
  })
  const rows = matchCalEvents(
    [
      ev('past', 'Bank call', '2026-09-01', { start: '09:00' }),
      ev('soon', 'Bank docs', '2026-10-02', { start: '11:00' }),
      ev('notes', 'Financing', '2026-10-01', { notes: 'send bank packet', start: '08:00' }),
      ev('exact', 'Bank', '2026-10-03', { start: '09:00' }),
    ],
    'bank',
    '2026-09-28',
  )
  assert.deepEqual(rows.map((e) => e.id), ['exact', 'soon', 'notes', 'past'])
})

test('calendar search ignores blank queries', () => {
  assert.deepEqual(matchCalEvents([{ id: 'a', title: 'Call', notes: '', date: '2026-10-01', allDay: true, color: '', location: '' }], '  ', '2026-09-28'), [])
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
  assert.equal(looksLikeHtml('Hit <profit> this quarter'), false)
  assert.match(toEditorHtml('Hit <profit> this quarter'), /profit/)
  assert.equal(toEditorHtml(''), '<p><br></p>')
  assert.match(toEditorHtml('hello\n\nworld'), /<p>hello<\/p>/)
  assert.match(toEditorHtml('hello\nworld'), /hello<br>world/)
  assert.equal(toEditorHtml('<h1>A</h1>'), '<h1>A</h1>')
  assert.equal(plainPreview('<p>Hello <b>world</b></p>'), 'Hello world')
  assert.equal(countWords('one two three').words, 3)
  assert.equal(countWords('<p></p>').words, 0)
  assert.equal(escapeHtml('<x>'), '&lt;x&gt;')
})

test('journal draft restores newer in-progress writing', () => {
  const parked = {
    date: '2026-09-23',
    at: Date.parse('2026-09-23T18:00:00Z'),
    draft: {
      blessings: ['a', '', ''] as [string, string, string],
      currentGoals: '<p>Keep the truck deal moving</p>',
      actionsToday: '',
      actionsTomorrow: '',
      mistakesToday: '<p>Rushed the call</p>',
      mistakeReflection: '',
      affirmation: '',
    },
  }
  const got = pickJournalDraft('2026-09-23', { updatedAt: '2026-09-23T12:00:00.000Z' }, parked)
  assert.equal(got?.currentGoals, '<p>Keep the truck deal moving</p>')
  assert.equal(pickJournalDraft('2026-09-22', { updatedAt: '2026-09-23T12:00:00.000Z' }, parked), null)
  const old = pickJournalDraft('2026-09-23', undefined, {
    date: '2026-09-23',
    at: Date.now(),
    draft: {
      blessings: ['a', '', ''],
      currentGoals: 'x',
      actionsToday: '',
      actionsTomorrow: '',
      affirmation: '',
    } as never,
  })
  assert.equal(old?.mistakesToday, '')
  assert.equal(old?.mistakeReflection, '')
})

test('journal archive only lists days with writing', () => {
  assert.equal(journalHasWriting({ actionsToday: '<p>Shipped it</p>' }), true)
  assert.equal(journalHasWriting({ actionsToday: '<p></p>', blessings: ['', '', ''] }), false)
  assert.equal(journalHasWriting({ workout: 'cardio' }), true)
})

test('journal archive download is oldest first', () => {
  const text = formatJournalArchive([
    {
      date: '2026-09-24',
      body: '',
      updatedAt: '',
      blessings: ['', '', ''],
      currentGoals: '',
      actionsToday: '<p>Day two</p>',
      actionsTomorrow: '',
      mistakesToday: '',
      mistakeReflection: '',
      affirmation: '',
      shortTermGoal: '',
      morningWins: ['', '', ''],
      morningChecks: [false, false, false],
    },
    {
      date: '2026-09-23',
      body: '',
      updatedAt: '',
      blessings: ['', '', ''],
      currentGoals: '',
      actionsToday: '<p>Day one</p>',
      actionsTomorrow: '',
      mistakesToday: '',
      mistakeReflection: '',
      affirmation: '',
      shortTermGoal: '',
      morningWins: ['', '', ''],
      morningChecks: [false, false, false],
    },
  ])
  assert.ok(text.indexOf('Day one') < text.indexOf('Day two'))
  assert.match(text, /oldest first/)
})

test('note sanitize strips scripts without executing', () => {
  const out = sanitizeNoteHtml('ok<script>alert(1)</script><b>hi</b>')
  assert.equal(out.includes('script'), false)
  assert.equal(out.includes('alert'), false)
})

test('google: overnight timed events split across local days', () => {
  const rows = fromGoogleEvent({
    id: 'night',
    summary: 'Red-eye',
    start: { dateTime: '2026-09-17T22:00:00' },
    end: { dateTime: '2026-09-18T02:00:00' },
  })
  assert.equal(rows.length, 2)
  assert.equal(rows[0]?.date, '2026-09-17')
  assert.equal(rows[0]?.start, '22:00')
  assert.equal(rows[0]?.end, '24:00')
  assert.equal(rows[1]?.date, '2026-09-18')
  assert.equal(rows[1]?.start, '00:00')
  assert.equal(rows[1]?.end, '02:00')
  const laid = layoutTimedEvents(rows.filter((e) => e.date === '2026-09-17'))
  assert.equal(laid[0]?.end, 24 * 60)
})

test('calendar: multi-day google all-day keeps a task per day', () => {
  const tasks = [
    task({ id: 'd1', title: 'Offsite', googleId: 'g-off', eventId: 'gcal:g-off:2026-09-20', due: '2026-09-20' }),
    task({ id: 'd2', title: 'Offsite', googleId: 'g-off', eventId: 'gcal:g-off:2026-09-21', due: '2026-09-21' }),
  ]
  assert.equal(matchLinkedTask(tasks, ev({ id: 'gcal:g-off:2026-09-20', title: 'Offsite', date: '2026-09-20', googleId: 'g-off' }))?.id, 'd1')
  assert.equal(matchLinkedTask(tasks, ev({ id: 'gcal:g-off:2026-09-21', title: 'Offsite', date: '2026-09-21', googleId: 'g-off' }))?.id, 'd2')
})

test('normalize: missing event color and task subtasks do not throw', () => {
  const next = normalizeState({
    version: 1,
    lists: [],
    tasks: [{ id: 't', title: 'Legacy', notes: '', listId: 'inbox', completed: false, priority: 0, createdAt: '', updatedAt: '' } as never],
    events: [{ id: 'e', title: 'Bare', notes: '', date: '2026-09-30', allDay: true, location: '' } as never],
    habits: [{ id: 'h', name: 'Read', color: '', archived: false, target: 1 } as never],
    habitLogs: null as never,
    notes: [],
    goals: [],
    journal: [],
    sessions: [{ id: 's', mode: 'focus', seconds: 60, completed: true } as never],
    settings: { googleClientId: '' } as never,
    projects: [],
    milestones: [{ id: 'm', projectId: 'p', name: 'Step', owner: '', status: 'current', criticalPath: true, sortOrder: 0, notes: '' } as never],
    workstreams: [],
    projectDecisions: [],
    blockers: [],
    waitingOnItems: [],
    projectActivity: [],
    goalCycles: null as never,
    goalCheckpoints: [],
    goalMovers: [],
    goalReviews: [],
    envActions: [],
    northStars: [],
  })
  assert.equal(next.tasks[0]?.subtasks.length, 0)
  assert.ok(next.events[0]?.color)
  assert.deepEqual(next.habits[0]?.days, [])
  assert.equal(next.sessions[0]?.endedAt, '')
  assert.deepEqual(next.milestones[0]?.dependsOn, [])
  assert.deepEqual(next.goalCycles, [])
})

test('cloud merge survives missing remote settings', () => {
  const local = {
    savedAt: 2,
    tasks: [],
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
  const remote = { ...local, savedAt: 1, settings: undefined as never }
  const merged = mergeStates(local as never, remote as never)
  assert.equal(merged.settings.googleClientId, 'local')
})

test('cloud journal merge keeps writing from the thin morning upsert', () => {
  const base = {
    savedAt: 2,
    tasks: [],
    events: [],
    lists: [],
    habits: [],
    habitLogs: [],
    notes: [],
    goals: [],
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
    ...base,
    savedAt: 20,
    journal: [
      {
        date: '2026-09-30',
        body: '',
        updatedAt: '2026-09-30T12:00:00.000Z',
        blessings: ['', '', ''] as [string, string, string],
        currentGoals: '',
        actionsToday: '',
        actionsTomorrow: '',
        mistakesToday: '',
        mistakeReflection: '',
        affirmation: '',
        shortTermGoal: 'Ship Sepho',
        morningWins: ['', '', ''] as [string, string, string],
        morningChecks: [true, false, false] as [boolean, boolean, boolean],
      },
    ],
  }
  const remote = {
    ...base,
    savedAt: 10,
    journal: [
      {
        date: '2026-09-30',
        body: 'Wrote code',
        updatedAt: '2026-09-30T08:00:00.000Z',
        blessings: ['health', '', ''] as [string, string, string],
        currentGoals: 'Keep the truck deal moving',
        actionsToday: 'Wrote code',
        actionsTomorrow: 'Test',
        mistakesToday: '',
        mistakeReflection: '',
        affirmation: '',
        shortTermGoal: '',
        morningWins: ['', '', ''] as [string, string, string],
        morningChecks: [false, false, false] as [boolean, boolean, boolean],
      },
    ],
  }
  const merged = mergeStates(local as never, remote as never)
  const row = merged.journal.find((j) => j.date === '2026-09-30')
  assert.equal(row?.shortTermGoal, 'Ship Sepho')
  assert.equal(row?.currentGoals, 'Keep the truck deal moving')
  assert.equal(row?.blessings[0], 'health')
  assert.equal(row?.morningChecks[0], true)
})

test('projects: unique steps on a duplicate copy move onto the keeper', () => {
  const blank = {
    version: 1 as const,
    savedAt: 1,
    lists: [],
    tasks: [],
    events: [],
    habits: [],
    habitLogs: [],
    notes: [],
    goals: [],
    journal: [],
    sessions: [],
    settings: { googleClientId: '' },
    projects: [
      {
        id: 'old',
        name: 'Fleet',
        company: '',
        owner: 'K',
        objective: '',
        definitionOfDone: '',
        successMetric: '',
        why: '',
        constraints: '',
        problem: '',
        desiredOutcome: '',
        assumptions: '',
        killPivot: '',
        state: 'active' as const,
        priority: 0,
        deadline: '2026-10-30',
        createdAt: 't',
        updatedAt: '2026-09-01',
      },
      {
        id: 'new',
        name: 'Fleet',
        company: '',
        owner: 'K',
        objective: 'Go',
        definitionOfDone: '',
        successMetric: '',
        why: '',
        constraints: '',
        problem: '',
        desiredOutcome: '',
        assumptions: '',
        killPivot: '',
        state: 'active' as const,
        priority: 0,
        deadline: '2026-10-30',
        createdAt: 't',
        updatedAt: '2026-09-28',
      },
    ],
    milestones: [
      {
        id: 'ms-shared',
        projectId: 'new',
        name: 'Secure Financing',
        owner: 'K',
        status: 'current' as const,
        criticalPath: true,
        sortOrder: 0,
        notes: '',
        dependsOn: [],
      },
      {
        id: 'ms-unique',
        projectId: 'old',
        name: 'Buy the truck',
        owner: 'K',
        status: 'upcoming' as const,
        criticalPath: true,
        sortOrder: 1,
        notes: '',
        dependsOn: [],
      },
    ],
    workstreams: [],
    projectDecisions: [],
    blockers: [],
    waitingOnItems: [],
    projectActivity: [{ id: 'a1', projectId: 'new', type: 'update', description: 'x', createdAt: '2026-09-28' }],
    goalCycles: [],
    goalCheckpoints: [],
    goalMovers: [],
    goalReviews: [],
    envActions: [],
    northStars: [],
  }
  const next = collapseDuplicateProjects(blank as never)
  assert.equal(next.projects.length, 1)
  assert.equal(next.projects[0]?.id, 'new')
  assert.equal(next.milestones.length, 2)
  assert.ok(next.milestones.some((m) => m.name === 'Buy the truck' && m.projectId === 'new'))
})

test('attention: overnight window wraps midnight', () => {
  assert.equal(inWindow(23 * 60, 22 * 60, 6 * 60), true)
  assert.equal(inWindow(2 * 60, 22 * 60, 6 * 60), true)
  assert.equal(inWindow(12 * 60, 22 * 60, 6 * 60), false)
  assert.equal(inWindow(10 * 60, 9 * 60, 12 * 60), true)
  assert.equal(inWindow(12 * 60, 9 * 60, 12 * 60), false)
  assert.equal(inWindow(3 * 60, 0, 0), true)
})

test('attention: settings and home never lock', () => {
  const a = defaultAttention()
  a.detox.active = true
  a.locks = [{ toolId: 'settings', enabled: true, interventions: ['pause'], bypassAllowed: false, days: [], startMin: 0, endMin: 0, profileIds: [] }]
  assert.equal(evaluateGate(a, 'home').blocked, false)
  assert.equal(evaluateGate(a, 'settings').blocked, false)
  assert.equal(evaluateGate(a, 'projects').blocked, true)
  assert.equal(evaluateGate(a, 'projects').reason, 'detox')
  assert.equal(evaluateGate(a, 'today').blocked, false)
})

test('attention: lock schedule and profile extra locks', () => {
  const a = defaultAttention()
  a.locks = [
    {
      toolId: 'notes',
      enabled: true,
      interventions: ['breath'],
      bypassAllowed: true,
      days: [1],
      startMin: 9 * 60,
      endMin: 12 * 60,
      profileIds: [],
    },
  ]
  const mondayMorning = new Date(2026, 8, 28, 10, 0, 0) // Monday
  const mondayAfternoon = new Date(2026, 8, 28, 15, 0, 0)
  const tuesdayMorning = new Date(2026, 8, 29, 10, 0, 0)
  assert.equal(evaluateGate(a, 'notes', mondayMorning).blocked, true)
  assert.equal(evaluateGate(a, 'notes', mondayAfternoon).blocked, false)
  assert.equal(evaluateGate(a, 'notes', tuesdayMorning).blocked, false)
  a.activeProfileId = 'study'
  const g = evaluateGate(a, 'projects', mondayAfternoon)
  assert.equal(g.blocked, true)
  assert.equal(g.reason, 'profile')
})

test('attention: detox until expires', () => {
  const a = defaultAttention()
  a.detox = { active: true, until: '2020-01-01T00:00:00.000Z', whitelist: ['today'] }
  assert.equal(detoxActive(a.detox, new Date('2026-01-01T00:00:00.000Z')), false)
  a.detox.until = '2099-01-01T00:00:00.000Z'
  assert.equal(detoxActive(a.detox, new Date('2026-01-01T00:00:00.000Z')), true)
})

test('attention: quiet streak ignores today after a locked open', () => {
  const a = defaultAttention()
  a.quietDays = ['2026-09-28', '2026-09-29']
  a.visits = [
    {
      id: 'v1',
      toolId: 'projects',
      startedAt: '2026-09-30T12:00:00.000Z',
      essential: false,
      locked: true,
    },
  ]
  assert.equal(quietStreak(a, '2026-09-30'), 0)
  a.visits = []
  a.quietDays = ['2026-09-29', '2026-09-30']
  assert.equal(quietStreak(a, '2026-09-30'), 2)
})

test('attention: normalize fills missing state and merge unions visits', () => {
  const n = normalizeAttention({})
  assert.equal(n.spaces.length, 4)
  assert.equal(n.onboarded, false)
  const left = normalizeAttention({
    onboarded: true,
    visits: [{ id: 'a', toolId: 'today', startedAt: '2026-09-30T10:00:00.000Z', essential: true, locked: false }],
  })
  const right = normalizeAttention({
    visits: [{ id: 'b', toolId: 'notes', startedAt: '2026-09-30T11:00:00.000Z', essential: true, locked: false }],
  })
  const m = mergeAttention(left, right, true)
  assert.equal(m.onboarded, true)
  assert.equal(m.visits.length, 2)
})

test('normalizeState seeds attention on old backups', () => {
  const s = normalizeState({
    version: 1,
    lists: [],
    tasks: [],
    events: [],
    habits: [],
    habitLogs: [],
    notes: [],
    goals: [],
    journal: [],
    sessions: [],
    settings: {} as never,
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
  } as never)
  assert.ok(s.attention.spaces.length >= 1)
  assert.equal(s.settings.phoneNumber, undefined)
})
