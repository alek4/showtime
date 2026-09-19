'use client'

import { useState } from 'react'
import { Shelf } from './shelf'
import { FilterBar } from './filter-bar'
import { applyFilters, deriveFilterOptions, DEFAULT_FILTERS } from '@/lib/watchlist-filters'
import type { WatchlistFilters } from '@/lib/watchlist-filters'
import type { Title, UserMeta } from '@/lib/types'

type Props = {
  titles: Title[]
  metaMap: Record<string, UserMeta>
  currentUserId: string
}

export function WatchlistClient({ titles, metaMap, currentUserId }: Props) {
  const [filters, setFilters] = useState<WatchlistFilters>(DEFAULT_FILTERS)
  const options = deriveFilterOptions(titles)
  const filtered = applyFilters(titles, filters, currentUserId)
  const unwatched = filtered.filter(t => !t.watched)
  const watched = filtered.filter(t => t.watched)

  return (
    <div>
      <FilterBar filters={filters} options={options} onChange={setFilters} />
      <div className="mt-4">
        {(filters.status === 'all' || filters.status === 'unwatched') && (
          <Shelf
            label="Want to watch"
            titles={unwatched}
            metaMap={metaMap}
            emptyMessage="Your queue is clear."
          />
        )}
        {(filters.status === 'all' || filters.status === 'watched') && (
          <Shelf
            label="Watched"
            titles={watched}
            metaMap={metaMap}
            emptyMessage="Nothing watched yet."
          />
        )}
      </div>
    </div>
  )
}
