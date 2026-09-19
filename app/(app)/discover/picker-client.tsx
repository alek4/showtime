'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { filterWatchlistTitles, pickRandom, TMDB_PROVIDER_MAP } from '@/lib/picker'
import type { PickerFilters } from '@/lib/picker'
import { TMDB_GENRE_MAP, tmdbPosterUrl } from '@/lib/tmdb'
import type { TMDBMovie, TMDBDiscoverResult } from '@/lib/tmdb'
import { PLATFORM_COLORS, deduplicatePlatforms, getItPlatforms } from '@/lib/streaming'
import { addTitleAction } from '../search/actions'
import type { Title } from '@/lib/types'

type WatchlistResult = { kind: 'watchlist'; title: Title }
type TmdbResult = { kind: 'tmdb'; movie: TMDBMovie; existingTitleId: string | null }
type PickResult = WatchlistResult | TmdbResult

type Props = {
  unwatchedTitles: Title[]
  tmdbIdToTitleId: Record<number, string>
}

const ALL_GENRES = Object.values(TMDB_GENRE_MAP).sort()
const ALL_PLATFORMS = Object.entries(PLATFORM_COLORS).map(([id, { label }]) => ({ id, label }))

export function PickerClient({ unwatchedTitles, tmdbIdToTitleId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [source, setSource] = useState<'watchlist' | 'tmdb'>('watchlist')
  const [platform, setPlatform] = useState<string | null>(null)
  const [genre, setGenre] = useState<string | null>(null)
  const [minRuntime, setMinRuntime] = useState('')
  const [maxRuntime, setMaxRuntime] = useState('')
  const [result, setResult] = useState<PickResult | null>(null)
  const [noMatch, setNoMatch] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)

  const filters: PickerFilters = {
    source,
    platform,
    genre,
    minRuntime: minRuntime ? parseInt(minRuntime, 10) : null,
    maxRuntime: maxRuntime ? parseInt(maxRuntime, 10) : null,
  }

  function resetResult() {
    setResult(null)
    setNoMatch(false)
    setError(null)
  }

  function handlePick() {
    resetResult()

    if (source === 'watchlist') {
      const filtered = filterWatchlistTitles(unwatchedTitles, filters)
      const picked = pickRandom(filtered)
      if (!picked) {
        setNoMatch(true)
      } else {
        setResult({ kind: 'watchlist', title: picked })
      }
      return
    }

    // "All TMDB" — two-step discover: first call reads total_pages, second fetches a random page
    startTransition(async () => {
      try {
        const params = new URLSearchParams({ action: 'discover', sort_by: 'popularity.desc' })
        if (filters.genre) {
          const genreEntry = Object.entries(TMDB_GENRE_MAP).find(([, name]) => name === filters.genre)
          if (genreEntry) params.set('with_genres', genreEntry[0])
        }
        if (filters.platform) {
          const providerId = TMDB_PROVIDER_MAP[filters.platform]
          if (providerId !== undefined) params.set('with_watch_providers', String(providerId))
        }
        if (filters.minRuntime) params.set('with_runtime.gte', String(filters.minRuntime))
        if (filters.maxRuntime) params.set('with_runtime.lte', String(filters.maxRuntime))
        params.set('page', '1')

        const res1 = await fetch(`/api/tmdb?${params}`)
        if (!res1.ok) throw new Error('TMDB request failed')
        const data1 = (await res1.json()) as TMDBDiscoverResult
        const totalPages = Math.min(data1.total_pages, 500)  // TMDB caps at page 500

        if (totalPages === 0 || data1.results.length === 0) {
          setNoMatch(true)
          return
        }

        const randomPage = Math.floor(Math.random() * totalPages) + 1
        let candidates = data1.results
        if (randomPage > 1) {
          params.set('page', String(randomPage))
          const res2 = await fetch(`/api/tmdb?${params}`)
          if (res2.ok) {
            const data2 = (await res2.json()) as TMDBDiscoverResult
            if (data2.results.length > 0) candidates = data2.results
          }
        }

        const movie = pickRandom(candidates)
        if (!movie) {
          setNoMatch(true)
          return
        }
        setResult({
          kind: 'tmdb',
          movie,
          existingTitleId: tmdbIdToTitleId[movie.id] ?? null,
        })
      } catch {
        setError('Something went wrong. Try again.')
      }
    })
  }

  async function handleAdd(movie: TMDBMovie) {
    setIsAdding(true)
    try {
      await addTitleAction(movie)
      // router.refresh() causes page.tsx to re-fetch getTitles(), updating tmdbIdToTitleId
      // so the button changes from "Add" to "View details" without a full page reload
      router.refresh()
    } finally {
      setIsAdding(false)
    }
  }

  const selectClass =
    'w-full bg-surface border border-rim rounded px-3 py-2 font-body text-sm text-primary min-h-[44px] focus:outline-none focus:border-amber/50'

  return (
    <div className="flex flex-col gap-6">
      {/* Source toggle */}
      <div className="flex gap-2">
        {(['watchlist', 'tmdb'] as const).map(s => (
          <button
            key={s}
            onClick={() => { setSource(s); resetResult() }}
            className={`font-body text-sm rounded-full px-4 py-2 min-h-[44px] border transition-colors ${
              source === s ? 'text-amber border-amber' : 'text-ghost border-rim hover:text-secondary hover:border-secondary/50'
            }`}
          >
            {s === 'watchlist' ? 'My watchlist' : 'All TMDB'}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div>
          <label className="font-body text-xs text-secondary mb-1 block">Platform</label>
          <select value={platform ?? ''} onChange={e => setPlatform(e.target.value || null)} className={selectClass}>
            <option value="">Any platform</option>
            {ALL_PLATFORMS.map(p => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="font-body text-xs text-secondary mb-1 block">Genre</label>
          <select value={genre ?? ''} onChange={e => setGenre(e.target.value || null)} className={selectClass}>
            <option value="">Any genre</option>
            {ALL_GENRES.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="font-body text-xs text-secondary mb-1 block">Min runtime (min)</label>
            <input
              type="number"
              value={minRuntime}
              onChange={e => setMinRuntime(e.target.value)}
              placeholder="e.g. 90"
              min={1}
              className="w-full bg-surface border border-rim rounded px-3 py-2 font-body text-sm text-primary min-h-[44px] placeholder:text-ghost focus:outline-none focus:border-amber/50"
            />
          </div>
          <div className="flex-1">
            <label className="font-body text-xs text-secondary mb-1 block">Max runtime (min)</label>
            <input
              type="number"
              value={maxRuntime}
              onChange={e => setMaxRuntime(e.target.value)}
              placeholder="e.g. 150"
              min={1}
              className="w-full bg-surface border border-rim rounded px-3 py-2 font-body text-sm text-primary min-h-[44px] placeholder:text-ghost focus:outline-none focus:border-amber/50"
            />
          </div>
        </div>
      </div>

      {/* Pick button */}
      <button
        onClick={handlePick}
        disabled={isPending}
        className="w-full font-display text-2xl tracking-wide bg-amber text-void rounded py-4 min-h-[56px] disabled:opacity-50 transition-opacity"
      >
        {isPending ? 'Picking…' : 'Pick for me'}
      </button>

      {/* Feedback */}
      {noMatch && (
        <p className="font-body text-sm text-secondary text-center">
          No titles match your filters.{source === 'watchlist' ? ' Try broadening your criteria.' : ''}
        </p>
      )}
      {error && (
        <p className="font-body text-sm text-crimson text-center">{error}</p>
      )}

      {/* Result */}
      {result && (
        <div className="border-t border-rim pt-6">
          <PickerResultCard result={result} onAdd={handleAdd} isAdding={isAdding} tmdbIdToTitleId={tmdbIdToTitleId} />
        </div>
      )}
    </div>
  )
}

// ── Result card ──────────────────────────────────────────────────────────────

function PickerResultCard({
  result,
  onAdd,
  isAdding,
  tmdbIdToTitleId,
}: {
  result: PickResult
  onAdd: (movie: TMDBMovie) => void
  isAdding: boolean
  tmdbIdToTitleId: Record<number, string>
}) {
  const posterUrl =
    result.kind === 'watchlist'
      ? result.title.poster_url
      : tmdbPosterUrl(result.movie.poster_path)

  const titleText =
    result.kind === 'watchlist' ? result.title.title : result.movie.title

  const year =
    result.kind === 'watchlist'
      ? result.title.year
      : result.movie.release_date
      ? parseInt(result.movie.release_date.slice(0, 4), 10)
      : null

  // Streaming platform badges — only available for watchlist titles (streaming_data in DB)
  const platforms =
    result.kind === 'watchlist'
      ? deduplicatePlatforms(getItPlatforms(result.title.streaming_data)).slice(0, 3)
      : []

  // detailHref reads from live tmdbIdToTitleId prop (updates after router.refresh() on add)
  const detailHref =
    result.kind === 'watchlist'
      ? `/titles/${result.title.id}`
      : tmdbIdToTitleId[result.movie.id]
      ? `/titles/${tmdbIdToTitleId[result.movie.id]}`
      : null

  const letterboxdHref =
    result.kind === 'tmdb' && !detailHref
      ? `https://letterboxd.com/search/films/${encodeURIComponent(`${titleText}${year !== null ? ` ${year}` : ''}`)}`
      : null

  return (
    <div className="flex gap-4 items-start">
      {/* Poster */}
      <div className="relative shrink-0 w-28 aspect-[2/3] rounded overflow-hidden bg-surface">
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={titleText}
            fill
            className="object-cover"
            sizes="112px"
          />
        ) : (
          <div className="absolute inset-0 bg-raised" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col gap-2 pt-1">
        <div>
          <p className="font-display text-2xl tracking-wide text-primary leading-tight">{titleText}</p>
          {year !== null && (
            <p className="font-body text-sm text-secondary">{year}</p>
          )}
        </div>

        {platforms.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {platforms.map(p => {
              const colors = PLATFORM_COLORS[p.service.id]
              if (!colors) return null
              return (
                <span
                  key={p.service.id}
                  className={`font-body text-xs px-2 py-0.5 rounded text-primary ${colors.tailwindBg}`}
                >
                  {colors.label}
                </span>
              )
            })}
          </div>
        )}

        {detailHref ? (
          <Link href={detailHref} className="font-body text-sm text-amber hover:underline self-start">
            View details →
          </Link>
        ) : (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => result.kind === 'tmdb' && onAdd(result.movie)}
              disabled={isAdding}
              className="inline-flex items-center gap-2 font-body text-sm text-amber border border-amber/50 rounded px-3 py-2 min-h-[44px] self-start disabled:opacity-40 transition-opacity"
            >
              {isAdding ? 'Adding…' : '+ Add to watchlist'}
            </button>
            {letterboxdHref && (
              <a
                href={letterboxdHref}
                target="_blank"
                rel="noopener noreferrer"
                className="font-body text-xs text-ghost hover:text-secondary self-start"
              >
                Search on Letterboxd ↗
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
