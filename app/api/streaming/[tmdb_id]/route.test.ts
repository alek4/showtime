import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { GET } from './route'
import { createClient } from '@/lib/supabase/server'

type TitleRow = { streaming_data: unknown; streaming_cached_at: string | null } | null

function makeMockSupabase(titleRow: TitleRow) {
  const updateEq = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn().mockReturnValue({ eq: updateEq })
  const single = vi.fn().mockResolvedValue({ data: titleRow })
  const selectEq = vi.fn().mockReturnValue({ single })
  const select = vi.fn().mockReturnValue({ eq: selectEq })
  const from = vi.fn().mockReturnValue({ select, update })
  return { from, update, updateEq }
}

async function callRoute(tmdbId: string) {
  // _request is unused by the handler — a plain Request is fine
  return GET(
    new Request(`http://localhost/api/streaming/${tmdbId}`) as never,
    { params: Promise.resolve({ tmdb_id: tmdbId }) }
  )
}

describe('GET /api/streaming/[tmdb_id]', () => {
  beforeEach(() => {
    vi.stubEnv('STREAMING_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ result: { streamingInfo: { it: [] } } }),
    }))
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('returns cached data and skips external API call when cache is fresh', async () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const cachedData = { result: { streamingInfo: { it: [{ service: 'netflix' }] } } }

    vi.mocked(createClient).mockResolvedValue(
      makeMockSupabase({ streaming_data: cachedData, streaming_cached_at: oneHourAgo }) as never
    )

    const response = await callRoute('238')

    expect(fetch).not.toHaveBeenCalled()
    expect(response.status).toBe(200)
  })

  it('calls streaming API and upserts DB when cache is stale', async () => {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const mock = makeMockSupabase({ streaming_data: null, streaming_cached_at: twoDaysAgo })

    vi.mocked(createClient).mockResolvedValue(mock as never)

    await callRoute('238')

    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('streaming-availability.p.rapidapi.com'),
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-rapidapi-key': 'test-key' }),
      })
    )
    expect(mock.update).toHaveBeenCalledWith(
      expect.objectContaining({ streaming_cached_at: expect.any(String) })
    )
  })

  it('returns 400 for a non-numeric tmdb_id', async () => {
    const response = await callRoute('notanumber')
    expect(response.status).toBe(400)
  })
})
