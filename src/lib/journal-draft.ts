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

const WORKOUT_LABEL: Record<string, string> = {
  cardio: 'Cardio',
  weights: 'Weights',
  rest: 'Rest day',
  other: 'Other',
}

function block(title: string, html?: string) {
  const text = notePlainText(html || '')
  if (!text) return ''
  return `${title}\n${text}\n`
}

export function formatJournalArchive(
  entries: JournalEntry[],
  formatDate: (iso: string) => string = (iso) => iso,
): string {
  const days = [...entries].filter(journalHasWriting).sort((a, b) => a.date.localeCompare(b.date))
  const parts = days.map((e) => {
    const blessings = (e.blessings ?? []).map((b) => b.trim()).filter(Boolean)
    const lines = [
      formatDate(e.date),
      '',
      blessings.length ? `Three blessings\n${blessings.map((b) => `• ${b}`).join('\n')}\n` : '',
      e.workout ? `Workout\n${WORKOUT_LABEL[e.workout] || e.workout}\n` : '',
      block('Current goals', e.currentGoals),
      block('Actions I took today', e.actionsToday || e.body),
      block('Actions I’ll take tomorrow', e.actionsTomorrow),
      block('Key mistakes', e.mistakesToday),
      block('How I could’ve done it better', e.mistakeReflection),
      block('Daily affirmation', e.affirmation),
    ]
    return lines.filter(Boolean).join('\n').trim()
  })
  return ['SEPHO JOURNAL ARCHIVE', 'Chronological order — oldest first', '', parts.join('\n\n————\n\n')].join('\n').trim() + '\n'
}

export function downloadJournalArchive(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const file = new File([blob], filename, { type: 'text/plain' })
  const share = navigator as Navigator & { canShare?: (data: { files?: File[] }) => boolean; share?: (data: ShareData) => Promise<void> }
  if (share.canShare?.({ files: [file] }) && share.share) {
    void share.share({ files: [file], title: 'Journal archive' })
    return
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
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
