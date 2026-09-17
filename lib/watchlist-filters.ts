import { getItPlatforms } from '@/lib/streaming'
import type { Title } from '@/lib/types'

export type StatusFilter = 'all' | 'unwatched' | 'watched'
export type AddedByFilter = 'all' | 'me' | 'partner'

export type WatchlistFilters = {
  status: StatusFilter
  genres: string[]       // title must include ALL selected genres; empty = any genre
  platform: string | null // service.id, null = any platform
  addedBy: AddedByFilter
}

export const DEFAULT_FILTERS: WatchlistFilters = {
  status: 'all',
  genres: [],
  platform: null,
  addedBy: 'all',
}

export type FilterOptions = {
  allGenres: string[]
  allPlatforms: Array<{ id: string; label: string }>
}

export function applyFilters(
  titles: Title[],
  filters: WatchlistFilters,
  currentUserId: string,
): Title[] {
  return titles.filter(title => {
    if (filters.status === 'watched' && !title.watched) return false
    if (filters.status === 'unwatched' && title.watched) return false
    if (
      filters.genres.length > 0 &&
      !filters.genres.every(g => title.genres.includes(g))
    ) {
      return false
    }
    if (filters.platform !== null) {
      const platforms = getItPlatforms(title.streaming_data)
      if (!platforms.some(p => p.service.id === filters.platform)) return false
    }
    if (filters.addedBy === 'me' && title.added_by !== currentUserId) return false
    if (filters.addedBy === 'partner' && title.added_by === currentUserId) return false
    return true
  })
}

export function deriveFilterOptions(titles: Title[]): FilterOptions {
  const genreSet = new Set<string>()
  const platformMap = new Map<string, string>()

  for (const title of titles) {
    for (const genre of title.genres) genreSet.add(genre)
    for (const platform of getItPlatforms(title.streaming_data)) {
      platformMap.set(platform.service.id, platform.service.name)
    }
  }

  return {
    allGenres: [...genreSet].sort(),
    allPlatforms: [...platformMap.entries()].map(([id, label]) => ({ id, label })),
  }
}
