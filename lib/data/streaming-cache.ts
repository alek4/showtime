import { createClient } from '@/lib/supabase/server'
import { isCacheStale, buildStreamingUrl } from '@/lib/streaming'
import type { StreamingApiResponse } from '@/lib/streaming'

export async function refreshStreamingIfStale(
  tmdbId: number
): Promise<StreamingApiResponse | null> {
  const supabase = await createClient()

  const { data: row } = await supabase
    .from('titles')
    .select('streaming_data, streaming_cached_at')
    .eq('tmdb_id', tmdbId)
    .single()

  if (!row) return null

  if (!isCacheStale(row.streaming_cached_at)) {
    return row.streaming_data as StreamingApiResponse | null
  }

  if (!process.env.STREAMING_API_KEY) {
    return row.streaming_data as StreamingApiResponse | null
  }

  const response = await fetch(buildStreamingUrl(tmdbId), {
    headers: {
      'x-rapidapi-key': process.env.STREAMING_API_KEY,
      'x-rapidapi-host': 'streaming-availability.p.rapidapi.com',
    },
  })

  if (!response.ok) return row.streaming_data as StreamingApiResponse | null

  const freshData = (await response.json()) as StreamingApiResponse

  await supabase
    .from('titles')
    .update({
      streaming_data: freshData,
      streaming_cached_at: new Date().toISOString(),
    })
    .eq('tmdb_id', tmdbId)

  return freshData
}
