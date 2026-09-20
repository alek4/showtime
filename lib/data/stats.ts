import { createClient } from '@/lib/supabase/server'
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

export function formatWatchTime(minutes: number, hasGaps: boolean): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const formatted = `${h}h ${m}m`
  return hasGaps ? `~${formatted}` : formatted
}

// ─── DB query ─────────────────────────────────────────────────────────────────

export async function getWatchStats(): Promise<WatchStats> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('titles')
    .select('genres, runtime_minutes, watched, watched_at')
    .is('removed_at', null)
  if (error) throw error

  const titles = data ?? []
  const watched = titles.filter(t => t.watched)

  return {
    totalWatched: watched.length,
    backlog: titles.length - watched.length,
    totalRuntime: computeRuntimeTotal(watched),
    genreBreakdown: computeGenreBreakdown(watched),
    monthlyTimeline: computeMonthlyTimeline(watched),
  }
}
