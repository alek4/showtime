import { getItPlatforms } from '@/lib/streaming'
import type { Title } from '@/lib/types'

export type PickerFilters = {
  source: 'watchlist' | 'tmdb'
  platform: string | null   // Streaming Availability service.id ('netflix', 'prime', etc.)
  genre: string | null      // genre name, e.g. 'Drama'
  minRuntime: number | null
  maxRuntime: number | null
}

// Maps Streaming Availability service.id → TMDB watch provider ID for watch_region=IT.
// Verify against TMDB /watch/providers/movie?watch_region=IT if results seem wrong.
export const TMDB_PROVIDER_MAP: Record<string, number> = {
  netflix:   8,
  prime:     119,
  disney:    337,
  apple:     350,
  mubi:      11,
  paramount: 531,
  now:       39,
}

// Filters a list of pre-selected unwatched titles by the user's picker filters.
// Does not re-check title.watched — callers must pass only unwatched titles.
export function filterWatchlistTitles(
  titles: Title[],
  filters: Pick<PickerFilters, 'genre' | 'platform' | 'minRuntime' | 'maxRuntime'>
): Title[] {
  return titles.filter(title => {
    if (filters.genre && !title.genres.includes(filters.genre)) return false
    if (
      filters.minRuntime !== null &&
      (title.runtime_minutes === null || title.runtime_minutes < filters.minRuntime)
    ) return false
    if (
      filters.maxRuntime !== null &&
      title.runtime_minutes !== null &&
      title.runtime_minutes > filters.maxRuntime
    ) return false
    if (filters.platform !== null) {
      const platforms = getItPlatforms(title.streaming_data)
      if (!platforms.some(p => p.service.id === filters.platform)) return false
    }
    return true
  })
}

export function pickRandom<T>(items: T[]): T | null {
  if (items.length === 0) return null
  return items[Math.floor(Math.random() * items.length)]
}
