import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockClient = { from: vi.fn() }
const mockCreateBrowserClient = vi.fn(() => mockClient)

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: mockCreateBrowserClient,
  createServerClient: vi.fn(),
}))

describe('lib/supabase/client', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key')
    mockCreateBrowserClient.mockClear()
    vi.resetModules()
  })

  it('calls createBrowserClient with URL and anon key', async () => {
    const { createClient } = await import('@/lib/supabase/client')
    createClient()
    expect(mockCreateBrowserClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-anon-key'
    )
  })
})
