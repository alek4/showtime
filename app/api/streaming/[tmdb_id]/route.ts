import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isCacheStale, buildStreamingUrl } from '@/lib/streaming'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tmdb_id: string }> }
) {
  const { tmdb_id } = await params
  const tmdbId = parseInt(tmdb_id, 10)

  if (isNaN(tmdbId)) {
    return NextResponse.json({ error: 'Invalid tmdb_id' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: title } = await supabase
    .from('titles')
    .select('streaming_data, streaming_cached_at')
    .eq('tmdb_id', tmdbId)
    .single()

  if (!title) {
    return NextResponse.json({ error: 'Title not found' }, { status: 404 })
  }

  if (!isCacheStale(title.streaming_cached_at)) {
    return NextResponse.json(title.streaming_data)
  }

  if (!process.env.STREAMING_API_KEY) {
    return NextResponse.json({ error: 'Streaming API not configured' }, { status: 500 })
  }

  const response = await fetch(buildStreamingUrl(tmdbId), {
    headers: {
      'x-rapidapi-key': process.env.STREAMING_API_KEY,
      'x-rapidapi-host': 'streaming-availability.p.rapidapi.com',
    },
  })

  const streamingData: unknown = await response.json()

  await supabase
    .from('titles')
    .update({
      streaming_data: streamingData,
      streaming_cached_at: new Date().toISOString(),
    })
    .eq('tmdb_id', tmdbId)

  return NextResponse.json(streamingData)
}
