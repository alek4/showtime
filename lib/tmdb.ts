// ─── Types ────────────────────────────────────────────────────────────────────

export type TMDBMovie = {
  id: number
  title: string
  release_date: string        // "YYYY-MM-DD"
  poster_path: string | null
  overview: string
  genre_ids: number[]
  popularity: number
  vote_average: number
}

export type TMDBMovieDetail = {
  id: number
  title: string
  release_date: string
  poster_path: string | null
  overview: string
  runtime: number | null
  genres: Array<{ id: number; name: string }>
  credits: {
    cast: Array<{
      id: number
      name: string
      character: string
      order: number
    }>
  }
}

export type TMDBPagedResult<T> = {
  page: number
  results: T[]
  total_pages: number
  total_results: number
}

export type TMDBSearchResult = TMDBPagedResult<TMDBMovie>
export type TMDBDiscoverResult = TMDBPagedResult<TMDBMovie>

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TMDB_BASE = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500'

export function tmdbPosterUrl(posterPath: string | null): string | null {
  if (!posterPath) return null
  return `${TMDB_IMAGE_BASE}${posterPath}`
}

/**
 * Builds a TMDB API URL from the route's incoming search params.
 * Returns null for unknown or invalid actions — caller should respond 400.
 * The API key is NOT included here; the route handler adds it as a header.
 */
export function buildTmdbUrl(params: URLSearchParams): string | null {
  const action = params.get('action')

  switch (action) {
    case 'search': {
      const out = new URLSearchParams()
      out.set('query', params.get('query') ?? '')
      out.set('page', params.get('page') ?? '1')
      out.set('language', 'en-US')
      return `${TMDB_BASE}/search/movie?${out.toString()}`
    }
    case 'detail': {
      const id = params.get('id')
      if (!id) return null
      const out = new URLSearchParams()
      out.set('append_to_response', 'credits')
      out.set('language', 'en-US')
      return `${TMDB_BASE}/movie/${id}?${out.toString()}`
    }
    case 'discover': {
      const out = new URLSearchParams()
      params.forEach((value, key) => {
        if (key !== 'action') out.set(key, value)
      })
      // watch_region=IT is authoritative — always override caller value
      out.set('watch_region', 'IT')
      if (!out.has('language')) out.set('language', 'en-US')
      return `${TMDB_BASE}/discover/movie?${out.toString()}`
    }
    default:
      return null
  }
}
