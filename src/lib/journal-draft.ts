import { notePlainText } from './note-body'
import type { JournalEntry } from './types'

export type JournalDraft = {
  blessings: [string, string, string]
  workout?: 'cardio' | 'weights' | 'rest' | 'other'
  currentGoals: string
  actionsToday: string
  actionsTomorrow: string
  mistakesToday: string
  mistakeReflection: string
  affirmation: string
}

export const JOURNAL_DRAFT_KEY = 'north.journal.draft'

export function emptyJournalDraft(): JournalDraft {
  return {
    blessings: ['', '', ''],
    workout: undefined,
    currentGoals: '',
    actionsToday: '',
    actionsTomorrow: '',
    mistakesToday: '',
    mistakeReflection: '',
    affirmation: '',
  }
}

export function normalizeJournalDraft(raw?: Partial<JournalDraft> | null): JournalDraft {
  const empty = emptyJournalDraft()
  if (!raw) return empty
  const b = Array.isArray(raw.blessings) ? raw.blessings : empty.blessings
  return {
    blessings: [String(b[0] ?? ''), String(b[1] ?? ''), String(b[2] ?? '')],
    workout: raw.workout,
    currentGoals: String(raw.currentGoals ?? ''),
    actionsToday: String(raw.actionsToday ?? ''),
    actionsTomorrow: String(raw.actionsTomorrow ?? ''),
    mistakesToday: String(raw.mistakesToday ?? ''),
    mistakeReflection: String(raw.mistakeReflection ?? ''),
    affirmation: String(raw.affirmation ?? ''),
  }
}

export function pickJournalDraft(
  date: string,
  saved?: { updatedAt?: string; currentGoals?: string; actionsToday?: string; actionsTomorrow?: string; body?: string },
  parked?: { date: string; at: number; draft: JournalDraft } | null,
): JournalDraft | null {
  if (!parked || parked.date !== date || !parked.draft) return null
  const savedAt = Date.parse(saved?.updatedAt || '') || 0
  if (parked.at + 50 < savedAt) return null
  const d = parked.draft
  const has =
    Boolean(d.currentGoals?.trim()) ||
    Boolean(d.actionsToday?.trim()) ||
    Boolean(d.actionsTomorrow?.trim()) ||
    Boolean(d.mistakesToday?.trim()) ||
    Boolean(d.mistakeReflection?.trim()) ||
    Boolean(d.affirmation?.trim()) ||
    Boolean(d.workout) ||
    d.blessings?.some((b) => b.trim())
  if (!has) return null
  return normalizeJournalDraft(d)
}

export function writeJournalDraft(date: string, draft: JournalDraft) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(JOURNAL_DRAFT_KEY, JSON.stringify({ date, draft, at: Date.now() }))
  } catch {
    /* quota */
  }
}

export function journalHasWriting(entry: Partial<JournalEntry> | JournalDraft | null | undefined): boolean {
  if (!entry) return false
  const bits = [
    'currentGoals' in entry ? entry.currentGoals : '',
    'actionsToday' in entry ? entry.actionsToday : '',
    'actionsTomorrow' in entry ? entry.actionsTomorrow : '',
    'mistakesToday' in entry ? entry.mistakesToday : '',
    'mistakeReflection' in entry ? entry.mistakeReflection : '',
    'affirmation' in entry ? entry.affirmation : '',
    'body' in entry ? entry.body : '',
    ...('blessings' in entry && Array.isArray(entry.blessings) ? entry.blessings : []),
  ]
  if (bits.some((b) => notePlainText(String(b ?? '')))) return true
  return Boolean('workout' in entry && entry.workout)
}

export function journalPreview(entry: JournalEntry, max = 110): string {
  const parts = [entry.actionsToday || entry.body, entry.mistakesToday, entry.currentGoals, entry.affirmation]
    .map((p) => notePlainText(p || ''))
    .filter(Boolean)
  const text = parts.join(' · ')
  if (!text) return 'Written that day.'
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

export function readJournalDraft(date: string, saved?: { updatedAt?: string }): JournalDraft | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(JOURNAL_DRAFT_KEY)
    if (!raw) return null
    return pickJournalDraft(date, saved, JSON.parse(raw) as { date: string; at: number; draft: JournalDraft })
  } catch {
    return null
  }
}
