import type { RuntimeTotal, WatchStats } from '@/lib/types'

// ─── Pure helpers ─────────────────────────────────────────────────────────────

export function computeRuntimeTotal(
  titles: Array<{ runtime_minutes: number | null }>
): RuntimeTotal {
  let minutes = 0
  let hasGaps = false
  for (const t of titles) {
    if (t.runtime_minutes === null) {
      hasGaps = true
    } else {
      minutes += t.runtime_minutes
    }
  }
  return { minutes, hasGaps }
}
