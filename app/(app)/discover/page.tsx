import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTitles } from '@/lib/data/titles'
import { PickerClient } from './picker-client'

export default async function DiscoverPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const allTitles = await getTitles()
  const unwatchedTitles = allTitles.filter(t => !t.watched)
  // Maps tmdb_id → title.id for all active titles (watched or not)
  // Used to show "View details" link when a TMDB discover result is already in our list
  const tmdbIdToTitleId: Record<number, string> = Object.fromEntries(
    allTitles.map(t => [t.tmdb_id, t.id])
  )

  return (
    <main className="bg-void min-h-screen pb-24">
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <h1 className="font-display text-4xl tracking-wide text-primary mb-6">Discover</h1>
        <PickerClient unwatchedTitles={unwatchedTitles} tmdbIdToTitleId={tmdbIdToTitleId} />
      </div>
    </main>
  )
}
