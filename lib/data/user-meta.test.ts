import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { upsertUserMeta, getUserMeta, getAllUserMeta } from './user-meta'

describe('upsertUserMeta', () => {
  afterEach(() => vi.clearAllMocks())

  it('upserts on conflict (user_id, title_id) and returns the saved row', async () => {
    const savedMeta = {
      user_id: 'user-1',
      title_id: 'title-1',
      want_to_watch: true,
      rating: 4,
      note: null,
      rated_at: '2026-09-17T10:00:00Z',
    }
    const single = vi.fn().mockResolvedValue({ data: savedMeta, error: null })
    const selectAfterUpsert = vi.fn().mockReturnValue({ single })
    const upsert = vi.fn().mockReturnValue({ select: selectAfterUpsert })
    const from = vi.fn().mockReturnValue({ upsert })
    vi.mocked(createClient).mockResolvedValue({ from } as never)

    const result = await upsertUserMeta('user-1', 'title-1', { want_to_watch: true, rating: 4 })

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', title_id: 'title-1', want_to_watch: true, rating: 4 }),
      { onConflict: 'user_id,title_id' }
    )
    expect(result).toEqual(savedMeta)
  })

  it('sets rated_at when rating is provided', async () => {
    const single = vi.fn().mockResolvedValue({ data: {}, error: null })
    const selectAfterUpsert = vi.fn().mockReturnValue({ single })
    const upsert = vi.fn().mockReturnValue({ select: selectAfterUpsert })
    const from = vi.fn().mockReturnValue({ upsert })
    vi.mocked(createClient).mockResolvedValue({ from } as never)

    await upsertUserMeta('user-1', 'title-1', { rating: 3 })

    const payload = upsert.mock.calls[0][0] as Record<string, unknown>
    expect(typeof payload.rated_at).toBe('string')
  })

  it('does not set rated_at when only want_to_watch is updated', async () => {
    const single = vi.fn().mockResolvedValue({ data: {}, error: null })
    const selectAfterUpsert = vi.fn().mockReturnValue({ single })
    const upsert = vi.fn().mockReturnValue({ select: selectAfterUpsert })
    const from = vi.fn().mockReturnValue({ upsert })
    vi.mocked(createClient).mockResolvedValue({ from } as never)

    await upsertUserMeta('user-1', 'title-1', { want_to_watch: false })

    const payload = upsert.mock.calls[0][0] as Record<string, unknown>
    expect(payload.rated_at).toBeUndefined()
  })
})

describe('getUserMeta', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns meta when found', async () => {
    const fakeMeta = { user_id: 'user-1', title_id: 'title-1', want_to_watch: false, rating: null, note: null, rated_at: null }
    const single = vi.fn().mockResolvedValue({ data: fakeMeta, error: null })
    const eq2 = vi.fn().mockReturnValue({ single })
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 })
    const select = vi.fn().mockReturnValue({ eq: eq1 })
    const from = vi.fn().mockReturnValue({ select })
    vi.mocked(createClient).mockResolvedValue({ from } as never)

    const result = await getUserMeta('user-1', 'title-1')

    expect(result).toEqual(fakeMeta)
  })

  it('returns null when no row exists (PGRST116)', async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'No rows' } })
    const eq2 = vi.fn().mockReturnValue({ single })
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 })
    const select = vi.fn().mockReturnValue({ eq: eq1 })
    const from = vi.fn().mockReturnValue({ select })
    vi.mocked(createClient).mockResolvedValue({ from } as never)

    const result = await getUserMeta('user-1', 'title-1')

    expect(result).toBeNull()
  })
})

describe('getAllUserMeta', () => {
  afterEach(() => vi.clearAllMocks())

  it('returns all meta rows for a given user', async () => {
    const mockMeta = [
      { user_id: 'u1', title_id: 't1', want_to_watch: true, rating: 4, note: null, rated_at: null },
      { user_id: 'u1', title_id: 't2', want_to_watch: false, rating: null, note: null, rated_at: null },
    ]
    const eq = vi.fn().mockResolvedValue({ data: mockMeta, error: null })
    const select = vi.fn().mockReturnValue({ eq })
    const from = vi.fn().mockReturnValue({ select })
    vi.mocked(createClient).mockResolvedValue({ from } as never)

    const result = await getAllUserMeta('u1')

    expect(result).toEqual(mockMeta)
    expect(from).toHaveBeenCalledWith('user_title_meta')
    expect(eq).toHaveBeenCalledWith('user_id', 'u1')
  })

  it('returns empty array when no meta exists', async () => {
    const eq = vi.fn().mockResolvedValue({ data: null, error: null })
    const select = vi.fn().mockReturnValue({ eq })
    const from = vi.fn().mockReturnValue({ select })
    vi.mocked(createClient).mockResolvedValue({ from } as never)

    const result = await getAllUserMeta('u1')

    expect(result).toEqual([])
  })

  it('throws when Supabase returns an error', async () => {
    const eq = vi.fn().mockResolvedValue({ data: null, error: new Error('db error') })
    const select = vi.fn().mockReturnValue({ eq })
    const from = vi.fn().mockReturnValue({ select })
    vi.mocked(createClient).mockResolvedValue({ from } as never)

    await expect(getAllUserMeta('u1')).rejects.toThrow('db error')
  })
})
