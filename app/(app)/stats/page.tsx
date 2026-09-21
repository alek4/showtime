import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getWatchStats, formatWatchTime, fillTimelineGaps } from '@/lib/data/stats'
import { StatCard } from './stat-card'
import { GenreChart } from './genre-chart'
import { TimelineChart } from './timeline-chart'

export default async function StatsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const stats = await getWatchStats()
  const watchTime = formatWatchTime(stats.totalRuntime.minutes, stats.totalRuntime.hasGaps)
  const topGenre = stats.genreBreakdown[0]?.genre ?? '—'
  const timelineData = fillTimelineGaps(stats.monthlyTimeline)

  return (
    <main className="bg-void min-h-screen pt-6 pb-4">
      <h1 className="font-display text-4xl tracking-wide text-primary px-4 mb-6">
        Stats
      </h1>
      <div className="px-4 space-y-8">
        <div className="grid grid-cols-2 gap-4">
          <StatCard value={String(stats.totalWatched)} label="Watched" />
          <StatCard value={String(stats.backlog)} label="Backlog" />
          <StatCard value={watchTime} label="Watch time" />
          <StatCard value={topGenre} label="Top genre" small />
        </div>

        {stats.genreBreakdown.length > 0 && (
          <section>
            <h2 className="font-display text-2xl tracking-wide text-primary mb-3">
              By genre
            </h2>
            <GenreChart data={stats.genreBreakdown} />
          </section>
        )}

        <section>
          <h2 className="font-display text-2xl tracking-wide text-primary mb-3">
            Monthly
          </h2>
          <TimelineChart data={timelineData} />
        </section>
      </div>
    </main>
  )
}
