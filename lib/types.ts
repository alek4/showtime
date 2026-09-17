import type { StreamingApiResponse } from '@/lib/streaming'

export type Title = {
  id: string
  tmdb_id: number
  title: string
  year: number
  poster_url: string | null
  runtime_minutes: number | null
  genres: string[]
  overview: string
  letterboxd_search_url: string
  watched: boolean
  watched_at: string | null         // ISO 8601 timestamptz
  added_by: string                  // uuid matching auth.users.id
  added_at: string                  // ISO 8601 timestamptz
  streaming_data: StreamingApiResponse | null
  streaming_cached_at: string | null // ISO 8601 timestamptz
  removed_at: string | null          // null = active; set = soft-deleted
}

// Input shape for addTitle — DB-generated fields omitted
export type NewTitle = {
  tmdb_id: number
  title: string
  year: number
  poster_url: string | null
  runtime_minutes: number | null
  genres: string[]
  overview: string
  letterboxd_search_url: string
  added_by: string
}

export type UserMeta = {
  user_id: string
  title_id: string
  want_to_watch: boolean
  rating: number | null   // 1–5 stars; null = not rated
  note: string | null
  rated_at: string | null // ISO 8601; set when rating changes
}

// Fields callers can update via upsertUserMeta
export type UserMetaUpdate = {
  want_to_watch?: boolean
  rating?: number | null
  note?: string | null
}

export type RuntimeTotal = {
  minutes: number
  hasGaps: boolean  // true when any watched title had null runtime_minutes
}

export type WatchStats = {
  totalWatched: number
  backlog: number
  totalRuntime: RuntimeTotal
  genreBreakdown: Array<{ genre: string; count: number }>  // sorted count desc
  monthlyTimeline: Array<{ month: string; count: number }> // "YYYY-MM", sorted asc
}
