import { PosterCard } from './poster-card'
import type { Title, UserMeta } from '@/lib/types'

type ShelfProps = {
  label: string
  titles: Title[]
  metaMap: Record<string, UserMeta>
  emptyMessage?: string
}

export function Shelf({ label, titles, metaMap, emptyMessage = 'Nothing here yet.' }: ShelfProps) {
  return (
    <section className="mb-8">
      <h2 className="font-display text-2xl tracking-wide text-primary px-4 mb-3">{label}</h2>
      {titles.length === 0 ? (
        <p className="font-accent italic text-ghost text-sm px-4 opacity-60">{emptyMessage}</p>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 px-4 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {titles.map(title => (
            <div key={title.id} className="snap-start shrink-0">
              <PosterCard title={title} meta={metaMap[title.id] ?? null} />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
