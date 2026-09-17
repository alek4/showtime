// ─── Types ────────────────────────────────────────────────────────────────────

// Shape of one streaming option in the v4 API response
export type StreamingPlatform = {
  service: {
    id: string        // e.g. "netflix", "prime", "disney"
    name: string
    homePage: string
    themeColorCode: string
    imageSet: Record<string, string>
  }
  type: 'subscription' | 'rent' | 'buy' | 'free' | string
  link: string
  quality?: string
  price?: { amount: string; currency: string; formatted: string }
  availableSince?: number
}

// Shape of the raw v4 API response — stored as-is in titles.streaming_data
export type StreamingApiResponse = {
  itemType?: string
  showType?: string
  id?: string
  tmdbId?: number
  streamingOptions?: {
    it?: StreamingPlatform[]
    [country: string]: StreamingPlatform[] | undefined
  }
}

// ─── Platform badge colors ────────────────────────────────────────────────────
// Colors desaturated ~20% per DESIGN.md to not fight the warm palette.
// Keys match the `service` field returned by the API.
export const PLATFORM_COLORS: Record<string, { bg: string; tailwindBg: string; label: string }> = {
  netflix:    { bg: '#CC2929', tailwindBg: 'bg-[#CC2929]', label: 'Netflix' },
  prime:      { bg: '#0F79AF', tailwindBg: 'bg-[#0F79AF]', label: 'Prime Video' },
  disney:     { bg: '#1436B8', tailwindBg: 'bg-[#1436B8]', label: 'Disney+' },
  apple:      { bg: '#555555', tailwindBg: 'bg-[#555555]', label: 'Apple TV+' },
  mubi:       { bg: '#2D2D2D', tailwindBg: 'bg-[#2D2D2D]', label: 'MUBI' },
  paramount:  { bg: '#2164F3', tailwindBg: 'bg-[#2164F3]', label: 'Paramount+' },
  now:        { bg: '#008A8A', tailwindBg: 'bg-[#008A8A]', label: 'NOW TV' },
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

export function getItPlatforms(data: StreamingApiResponse | null): StreamingPlatform[] {
  return data?.streamingOptions?.it ?? []
}

/**
 * Builds the Streaming Availability API v4 URL for a given TMDB movie ID.
 * Always targets Italy. API key is NOT included — added as a header by the route.
 */
export function buildStreamingUrl(tmdbId: number): string {
  const params = new URLSearchParams()
  params.set('country', 'it')
  params.set('output_language', 'en')
  return `https://streaming-availability.p.rapidapi.com/shows/movie/${tmdbId}?${params.toString()}`
}
