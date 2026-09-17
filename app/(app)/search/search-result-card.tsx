import Image from 'next/image'
import { tmdbPosterUrl } from '@/lib/tmdb'
import type { TMDBMovie } from '@/lib/tmdb'

type SearchResultCardProps = {
  movie: TMDBMovie
  isInList: boolean
  isAdding: boolean
  onAdd: () => void
}

export function SearchResultCard({ movie, isInList, isAdding, onAdd }: SearchResultCardProps) {
  const year = movie.release_date
    ? parseInt(movie.release_date.slice(0, 4), 10)
    : null
  const posterUrl = tmdbPosterUrl(movie.poster_path)

  return (
    <li className="flex items-center gap-3 py-3 border-b border-rim last:border-b-0">
      <div className="w-10 shrink-0">
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={movie.title}
            width={40}
            height={60}
            className="rounded object-cover"
          />
        ) : (
          <div className="w-10 h-[60px] bg-raised rounded" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-body font-medium text-primary truncate">{movie.title}</p>
        {year !== null && (
          <p className="font-body text-sm text-secondary">{year}</p>
        )}
      </div>

      <div className="shrink-0">
        {isInList ? (
          <span className="font-body text-xs text-ghost border border-ghost/30 rounded px-2 py-1">
            In list
          </span>
        ) : (
          <button
            onClick={onAdd}
            disabled={isAdding}
            className="font-body text-sm text-amber border border-amber/50 rounded px-3 min-h-[44px] disabled:opacity-40 transition-opacity"
          >
            {isAdding ? '…' : 'Add'}
          </button>
        )}
      </div>
    </li>
  )
}
