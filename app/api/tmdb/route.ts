import { NextRequest, NextResponse } from 'next/server'
import { buildTmdbUrl } from '@/lib/tmdb'

export async function GET(request: NextRequest) {
  if (!process.env.TMDB_API_KEY) {
    return NextResponse.json({ error: 'TMDB not configured' }, { status: 500 })
  }

  const tmdbUrl = buildTmdbUrl(request.nextUrl.searchParams)

  if (!tmdbUrl) {
    return NextResponse.json(
      { error: 'Invalid or missing action parameter' },
      { status: 400 }
    )
  }

  const response = await fetch(tmdbUrl, {
    headers: {
      Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
      'Content-Type': 'application/json',
    },
  })

  const data: unknown = await response.json()
  return NextResponse.json(data, { status: response.status })
}
