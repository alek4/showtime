import { notFound, redirect } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { getTitleById } from '@/lib/data/titles'
import { getUserMeta } from '@/lib/data/user-meta'
import { refreshStreamingIfStale } from '@/lib/data/streaming-cache'
import { isCacheStale, getItPlatforms, PLATFORM_COLORS } from '@/lib/streaming'
import { WatchedToggle } from './watched-toggle'
import { WantToWatchToggle } from './want-to-watch-toggle'
import { RatingInput } from './rating-input'
import { NoteInput } from './note-input'
import { RuntimeInput } from './runtime-input'
import { softDeleteAction } from './actions'

type Props = {
  params: Promise<{ id: string }>
}

export default async function TitleDetailPage({ params }: Props) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const title = await getTitleById(id)
  if (!title) notFound()

  // Synchronous cache refresh — per spec: "user waits ~1-2s, always sees fresh data"
  let streamingData = title.streaming_data
  if (isCacheStale(title.streaming_cached_at)) {
    streamingData = await refreshStreamingIfStale(title.tmdb_id)
  }

  const userMeta = await getUserMeta(user.id, title.id)
  const platforms = getItPlatforms(streamingData)

  const runtimeHours = title.runtime_minutes ? Math.floor(title.runtime_minutes / 60) : 0
  const runtimeMins = title.runtime_minutes ? title.runtime_minutes % 60 : 0
  const runtimeDisplay = title.runtime_minutes
    ? runtimeMins > 0
      ? `${runtimeHours}h ${runtimeMins}m`
      : `${runtimeHours}h`
    : null

  const deleteWithId = softDeleteAction.bind(null, title.id)

  return (
    <main className="bg-void min-h-screen pb-24">
      {/* Poster hero — fills top 50vh on mobile */}
      <div className="relative w-full h-[50vh]">
        {title.watched && (
          <div className="absolute top-0 inset-x-0 h-1 bg-red-600 z-10" />
        )}
        {title.poster_url ? (
          <Image
            src={title.poster_url}
            alt={title.title}
            fill
            className="object-cover object-top"
            sizes="100vw"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-surface" />
        )}
        {/* Gradient bleed into void background */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-void to-transparent" />
      </div>

      {/* Content */}
      <div className="px-4 pt-4">
        <h1 className="font-display text-4xl tracking-wide text-primary leading-tight">
          {title.title}
        </h1>
        <p className="font-body text-sm text-secondary mt-1">
          {title.year}
          {runtimeDisplay && ` · ${runtimeDisplay}`}
          {title.genres.length > 0 && ` · ${title.genres.join(', ')}`}
        </p>

        {/* Streaming badges */}
        {platforms.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {platforms.map(p => {
              const colors = PLATFORM_COLORS[p.service.id]
              if (!colors) return null
              return (
                <span
                  key={p.service.id}
                  className={`font-body text-xs px-2 py-1 rounded text-primary ${colors.tailwindBg}`}
                >
                  {colors.label}
                </span>
              )
            })}
          </div>
        ) : (
          <p className="font-body text-sm text-secondary mt-3">
            No streaming info available for Italy
          </p>
        )}

        {/* Letterboxd search link */}
        <a
          href={title.letterboxd_search_url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-body text-sm text-amber mt-3 inline-block hover:underline"
        >
          Search on Letterboxd →
        </a>

        {/* Shared: watched toggle */}
        <div className="mt-6">
          <WatchedToggle
            titleId={title.id}
            initialWatched={title.watched}
            watchedAt={title.watched_at}
          />
        </div>

        {/* Per-user section */}
        <div className="mt-6 flex flex-col gap-4 border-t border-rim pt-4">
          <WantToWatchToggle
            titleId={title.id}
            initialValue={userMeta?.want_to_watch ?? false}
          />

          <div>
            <p className="font-body text-xs text-secondary mb-2">Your rating</p>
            <RatingInput
              titleId={title.id}
              initialRating={userMeta?.rating ?? null}
            />
          </div>

          <div>
            <p className="font-body text-xs text-secondary mb-1">Your note</p>
            <NoteInput
              titleId={title.id}
              initialNote={userMeta?.note ?? null}
            />
          </div>
        </div>

        {/* Overview */}
        {title.overview && (
          <div className="mt-6 border-t border-rim pt-4">
            <p className="font-body text-sm text-secondary leading-relaxed">
              {title.overview}
            </p>
          </div>
        )}

        {/* Runtime input — only shown when runtime_minutes is null */}
        {title.runtime_minutes === null && (
          <div className="mt-6 border-t border-rim pt-4">
            <p className="font-body text-xs text-secondary mb-2">
              Runtime not available — add manually
            </p>
            <RuntimeInput titleId={title.id} />
          </div>
        )}

        {/* Soft-delete */}
        <div className="mt-8 border-t border-rim pt-4">
          <form action={deleteWithId}>
            <button
              type="submit"
              className="font-body text-sm text-crimson px-4 py-2 rounded border border-crimson-dim min-h-[44px] hover:bg-crimson-dim/20 transition-colors"
            >
              Remove from list
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
