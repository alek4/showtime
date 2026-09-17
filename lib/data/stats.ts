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

export function computeGenreBreakdown(
  titles: Array<{ genres: string[] }>
): Array<{ genre: string; count: number }> {
  const counts: Record<string, number> = {}
  for (const t of titles) {
    for (const g of t.genres) {
      counts[g] = (counts[g] ?? 0) + 1
    }
  }
  return Object.entries(counts)
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count)
}

export function computeMonthlyTimeline(
  titles: Array<{ watched_at: string | null }>
): Array<{ month: string; count: number }> {
  const counts: Record<string, number> = {}
  for (const t of titles) {
    if (!t.watched_at) continue
    const month = t.watched_at.slice(0, 7)  // "YYYY-MM"
    counts[month] = (counts[month] ?? 0) + 1
  }
  return Object.entries(counts)
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month))
}
