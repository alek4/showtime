import Link from 'next/link'
import Image from 'next/image'
import { getItPlatforms, deduplicatePlatforms, PLATFORM_COLORS } from '@/lib/streaming'
import type { Title, UserMeta } from '@/lib/types'

type PosterCardProps = {
  title: Title
  meta: UserMeta | null
}

export function PosterCard({ title, meta }: PosterCardProps) {
  const platforms = deduplicatePlatforms(getItPlatforms(title.streaming_data)).slice(0, 2)
  const wantsToWatch = meta?.want_to_watch === true

  return (
    <Link
      href={`/titles/${title.id}`}
      className="group block shrink-0 w-52"
      scroll={true}
    >
      <div className="relative aspect-[2/3] rounded overflow-hidden transition-transform duration-150 ease-out group-hover:scale-[1.04] group-hover:ring-1 group-hover:ring-amber/50">
        {title.watched && (
          <div className="absolute top-0 inset-x-0 h-1 bg-red-600 z-10" />
        )}

        {title.poster_url ? (
          <Image
            src={title.poster_url}
            alt={title.title}
            fill
            className="object-cover"
            sizes="208px"
          />
        ) : (
          <div className="absolute inset-0 bg-surface" />
        )}

        <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
          {title.genres.slice(0, 2).map(genre => (
            <span
              key={genre}
              className="font-body text-xs bg-void/80 text-primary px-1.5 py-0.5 rounded leading-tight"
            >
              {genre}
            </span>
          ))}
        </div>

        {wantsToWatch && (
          <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber z-10" />
        )}

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-void to-transparent pt-8 pb-2 px-2 z-10">
          <p className="font-display text-sm tracking-wide text-primary leading-tight truncate">
            {title.title}
          </p>
          <p className="font-body text-xs text-secondary">{title.year}</p>
          {platforms.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {platforms.map(p => {
                const colors = PLATFORM_COLORS[p.service.id]
                if (!colors) return null
                return (
                  <span
                    key={p.service.id}
                    className={`font-body text-xs px-1 py-0.5 rounded text-primary ${colors.tailwindBg}`}
                  >
                    {colors.label}
                  </span>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
