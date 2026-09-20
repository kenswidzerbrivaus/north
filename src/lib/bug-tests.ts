import assert from 'node:assert/strict'
import { test } from 'node:test'
import { layoutTimedEvents } from './cal-layout'
import { parseDeadline } from './dates'
import { fromGoogleEvent, toGoogleBody } from './google-calendar'
import { metricNumber } from './goal-engine'
import { daysLeft, depsReady, parseMilestoneLines } from './project-engine'
import { cloudAction } from './sync-policy'
import type { ProjectMilestone } from './types'

test('cloud: unsaved local never overwrites cloud', () => {
  assert.equal(cloudAction(0, 1000), 'pull')
  assert.equal(cloudAction(0, null), 'push')
  assert.equal(cloudAction(500, 1000), 'pull')
  assert.equal(cloudAction(2000, 1000), 'push')
  assert.equal(cloudAction(1000, 1000), 'noop')
  assert.equal(cloudAction(0, 0), 'push')
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
