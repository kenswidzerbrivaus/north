const prefix = 'sepho.draft.'

export function loadDraft<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(prefix + key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function saveDraft(key: string, value: unknown) {
  try {
    localStorage.setItem(prefix + key, JSON.stringify(value))
  } catch {
    /* quota */
  }
}

export function clearDraft(key: string) {
  try {
    localStorage.removeItem(prefix + key)
  } catch {
    /* ignore */
  }
}

export type ProjectDraft = {
  form?: Record<string, string>
  steps?: { name: string; date: string }[]
}

export function summarizeProjectDraft(draft: ProjectDraft | null, ownerDefault = ''): { name: string } | null {
  if (!draft?.form && !draft?.steps?.length) return null
  const form = draft.form ?? {}
  const formWork = Object.entries(form).some(([k, v]) => {
    const t = String(v ?? '').trim()
    if (!t) return false
    if (k === 'owner' && t === ownerDefault) return false
    return true
  })
  const stepWork = (draft.steps ?? []).some((s) => s.name.trim() || s.date.trim())
  if (!formWork && !stepWork) return null
  return { name: String(form.name ?? '').trim() || 'Untitled project' }
}

export function parkedProjectDraft(ownerDefault = '') {
  return summarizeProjectDraft(loadDraft<ProjectDraft>('project'), ownerDefault)
}
