import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { refreshStreamingIfStale } from './streaming-cache'

type Row = { streaming_data: unknown; streaming_cached_at: string | null } | null

function makeMockSupabase(row: Row) {
  const updateEq = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn().mockReturnValue({ eq: updateEq })
  const single = vi.fn().mockResolvedValue({ data: row })
  const selectEq = vi.fn().mockReturnValue({ single })
  const select = vi.fn().mockReturnValue({ eq: selectEq })
  const from = vi.fn().mockReturnValue({ select, update })
  return { from, update }
}

describe('refreshStreamingIfStale', () => {
  beforeEach(() => {
    vi.stubEnv('STREAMING_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ streamingOptions: { it: [] } }),
    }))
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('returns cached data and skips fetch when cache is fresh (< 24h)', async () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const cachedData = { streamingOptions: { it: [{ service: { id: 'netflix' } }] } }
    vi.mocked(createClient).mockResolvedValue(
      makeMockSupabase({ streaming_data: cachedData, streaming_cached_at: oneHourAgo }) as never
    )

    const result = await refreshStreamingIfStale(238)

    expect(fetch).not.toHaveBeenCalled()
    expect(result).toEqual(cachedData)
  })

  it('calls Streaming API and returns fresh data when cache is stale (> 24h)', async () => {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const freshData = { streamingOptions: { it: [{ service: { id: 'prime' } }] } }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => freshData,
    }))
    const mock = makeMockSupabase({ streaming_data: null, streaming_cached_at: twoDaysAgo })
    vi.mocked(createClient).mockResolvedValue(mock as never)

    const result = await refreshStreamingIfStale(238)

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
    expect(result).toEqual(freshData)
  })

  it('calls Streaming API when streaming_cached_at is null (never cached)', async () => {
    const mock = makeMockSupabase({ streaming_data: null, streaming_cached_at: null })
    vi.mocked(createClient).mockResolvedValue(mock as never)

    await refreshStreamingIfStale(238)

    expect(fetch).toHaveBeenCalledOnce()
  })

  it('returns null when title row is not found in DB', async () => {
    vi.mocked(createClient).mockResolvedValue(makeMockSupabase(null) as never)

    const result = await refreshStreamingIfStale(999)

    expect(result).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })
})
