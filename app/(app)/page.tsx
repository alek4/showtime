import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTitles } from '@/lib/data/titles'
import { getAllUserMeta } from '@/lib/data/user-meta'
import { WatchlistClient } from './components/watchlist-client'
import type { UserMeta } from '@/lib/types'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [titles, allMeta] = await Promise.all([
    getTitles(),
    getAllUserMeta(user.id),
  ])

  const metaMap: Record<string, UserMeta> = Object.fromEntries(
    allMeta.map(m => [m.title_id, m])
  )

  return (
    <main className="bg-void min-h-screen pt-6 pb-4">
      <h1 className="font-display text-4xl tracking-wide text-primary px-4 mb-4">Watchlist</h1>
      <WatchlistClient titles={titles} metaMap={metaMap} currentUserId={user.id} />
    </main>
  )
}
