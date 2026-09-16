// ─── Types ────────────────────────────────────────────────────────────────────

// Shape of one streaming option inside the API response's IT array
export type StreamingPlatform = {
  service: string           // e.g. "netflix", "prime", "disney"
  streamingType: 'subscription' | 'rent' | 'buy' | 'free' | string
  link: string
  quality?: string
}

// Shape of the raw v3 API response — stored as-is in titles.streaming_data
export type StreamingApiResponse = {
  result?: {
    streamingInfo?: {
      it?: StreamingPlatform[]
    }
  }
}

// ─── Platform badge colors ────────────────────────────────────────────────────
// Colors desaturated ~20% per DESIGN.md to not fight the warm palette.
// Keys match the `service` field returned by the API.
export const PLATFORM_COLORS: Record<string, { bg: string; label: string }> = {
  netflix:    { bg: '#CC2929', label: 'Netflix' },
  prime:      { bg: '#0F79AF', label: 'Prime Video' },
  disney:     { bg: '#1436B8', label: 'Disney+' },
  apple:      { bg: '#555555', label: 'Apple TV+' },
  mubi:       { bg: '#2D2D2D', label: 'MUBI' },
  paramount:  { bg: '#2164F3', label: 'Paramount+' },
  now:        { bg: '#008A8A', label: 'NOW TV' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 24 * 60 * 60 * 1000  // 24 hours in milliseconds

/**
 * Returns true if cachedAt is null (never cached) or older than 24 hours.
 * This is the single source of truth for the streaming cache TTL.
 */
export function isCacheStale(cachedAt: string | null): boolean {
  if (!cachedAt) return true
  return Date.now() - new Date(cachedAt).getTime() > CACHE_TTL_MS
}

/**
 * Builds the Streaming Availability API v3 URL for a given TMDB movie ID.
 * Always targets Italy. API key is NOT included — added as a header by the route.
 */
export function buildStreamingUrl(tmdbId: number): string {
  const params = new URLSearchParams()
  params.set('output_language', 'en')
  params.set('tmdb_id', `movie/${tmdbId}`)
  params.set('country', 'it')
  return `https://streaming-availability.p.rapidapi.com/get?${params.toString()}`
}
