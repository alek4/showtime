import { getTitles } from '@/lib/data/titles'
import { SearchClient } from './search-client'

export default async function SearchPage() {
  const titles = await getTitles()
  const existingTmdbIds = titles.map(t => t.tmdb_id)

  return (
    <main className="bg-void min-h-screen px-4 pt-6 pb-4 max-w-lg mx-auto">
      <h1 className="font-display text-4xl tracking-wide text-primary mb-6">Search</h1>
      <SearchClient existingTmdbIds={existingTmdbIds} />
    </main>
  )
}
