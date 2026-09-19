import type { WatchlistFilters, FilterOptions } from '@/lib/watchlist-filters'

type FilterBarProps = {
  filters: WatchlistFilters
  options: FilterOptions
  onChange: (filters: WatchlistFilters) => void
}

type ChipProps = {
  label: string
  active: boolean
  onClick: () => void
}

function Chip({ label, active, onClick }: ChipProps) {
  return (
    <button
      onClick={onClick}
      className={`font-body text-sm rounded-full px-3 min-h-[44px] flex items-center border transition-colors ${
        active
          ? 'text-amber border-amber'
          : 'text-ghost border-rim'
      }`}
    >
      {label}
    </button>
  )
}

export function FilterBar({ filters, options, onChange }: FilterBarProps) {
  function setStatus(status: WatchlistFilters['status']) {
    onChange({ ...filters, status })
  }

  function toggleGenre(genre: string) {
    const genres = filters.genres.includes(genre)
      ? filters.genres.filter(g => g !== genre)
      : [...filters.genres, genre]
    onChange({ ...filters, genres })
  }

  function togglePlatform(id: string) {
    onChange({ ...filters, platform: filters.platform === id ? null : id })
  }

  function setAddedBy(addedBy: WatchlistFilters['addedBy']) {
    onChange({ ...filters, addedBy })
  }

  return (
    <div className="overflow-x-auto pb-3 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      <div className="flex gap-6 px-4 min-w-max items-start">
        {/* Status */}
        <div className="flex gap-2">
          {(['all', 'unwatched', 'watched'] as const).map(s => (
            <Chip
              key={s}
              label={s === 'all' ? 'All' : s === 'unwatched' ? 'Want to watch' : 'Watched'}
              active={filters.status === s}
              onClick={() => setStatus(s)}
            />
          ))}
        </div>

        {/* Genre multi-select (only shown if genres exist) */}
        {options.allGenres.length > 0 && (
          <div className="flex gap-2">
            {options.allGenres.map(genre => (
              <Chip
                key={genre}
                label={genre}
                active={filters.genres.includes(genre)}
                onClick={() => toggleGenre(genre)}
              />
            ))}
          </div>
        )}

        {/* Platform single-select (only shown if platforms exist) */}
        {options.allPlatforms.length > 0 && (
          <div className="flex gap-2">
            {options.allPlatforms.map(p => (
              <Chip
                key={p.id}
                label={p.label}
                active={filters.platform === p.id}
                onClick={() => togglePlatform(p.id)}
              />
            ))}
          </div>
        )}

        {/* Added by */}
        <div className="flex gap-2">
          {(['all', 'me', 'partner'] as const).map(a => (
            <Chip
              key={a}
              label={a === 'all' ? 'All' : a === 'me' ? 'Me' : 'Partner'}
              active={filters.addedBy === a}
              onClick={() => setAddedBy(a)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
