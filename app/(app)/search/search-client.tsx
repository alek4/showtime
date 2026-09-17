'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { SearchResultCard } from './search-result-card'
import { addTitleAction } from './actions'
import type { TMDBMovie, TMDBSearchResult } from '@/lib/tmdb'

type Props = { existingTmdbIds: number[] }

export function SearchClient({ existingTmdbIds }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TMDBMovie[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState<number | null>(null)
  const [inList, setInList] = useState(() => new Set(existingTmdbIds))
  const router = useRouter()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!query.trim()) {
      setResults([])
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/tmdb?action=search&query=${encodeURIComponent(query.trim())}`
        )
        const data = (await res.json()) as TMDBSearchResult
        setResults(data.results ?? [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 400)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  async function handleAdd(movie: TMDBMovie) {
    setAdding(movie.id)
    try {
      await addTitleAction(movie)
      setInList(prev => new Set([...prev, movie.id]))
      router.refresh()
    } catch {
      // Server action failed — button reverts to "Add"; user can retry
    } finally {
      setAdding(null)
    }
  }

  return (
    <div>
      <input
        type="search"
        placeholder="Search movies…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        className="w-full bg-raised border border-rim rounded-lg px-4 py-3 font-body text-primary placeholder:text-ghost focus:outline-none focus:border-amber"
      />

      {loading && (
        <p className="font-body text-sm text-ghost mt-4 opacity-40">Searching…</p>
      )}

      {!loading && query.trim() && results.length === 0 && (
        <p className="font-body text-sm text-ghost mt-4">No results for &quot;{query}&quot;.</p>
      )}

      <ul className="mt-2">
        {results.map(movie => (
          <SearchResultCard
            key={movie.id}
            movie={movie}
            isInList={inList.has(movie.id)}
            isAdding={adding === movie.id}
            onAdd={() => handleAdd(movie)}
          />
        ))}
      </ul>
    </div>
  )
}
