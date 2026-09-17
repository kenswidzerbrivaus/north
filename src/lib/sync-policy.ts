/** Decide whether this device should load cloud data or upload local data. */
export function cloudAction(localAt: number, remoteAt: number | null): 'pull' | 'push' | 'noop' {
  const local = Number(localAt) || 0
  if (remoteAt == null) return 'push'
  const remote = Number(remoteAt) || 0
  if (local === 0) return remote > 0 ? 'pull' : 'push'
  if (remote > local) return 'pull'
  if (local > remote) return 'push'
  return 'noop'
}
