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
