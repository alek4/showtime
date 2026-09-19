'use client'

import { useOptimistic, useTransition } from 'react'
import { toggleWatchedAction } from './actions'

type Props = {
  titleId: string
  initialWatched: boolean
  watchedAt: string | null
}

export function WatchedToggle({ titleId, initialWatched, watchedAt }: Props) {
  const [isPending, startTransition] = useTransition()
  const [optimisticWatched, setOptimisticWatched] = useOptimistic(initialWatched)

  function handleToggle() {
    const next = !optimisticWatched
    startTransition(async () => {
      setOptimisticWatched(next)
      await toggleWatchedAction(titleId, next)
    })
  }

  const dateLabel = watchedAt
    ? new Date(watchedAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleToggle}
        disabled={isPending}
        className={`font-body text-sm px-4 py-2 rounded min-h-[44px] transition-colors disabled:opacity-40 ${
          optimisticWatched
            ? 'bg-crimson-dim text-primary hover:bg-crimson-dim/80'
            : 'bg-amber text-void hover:bg-amber-dim'
        }`}
      >
        {isPending ? 'Saving…' : optimisticWatched ? 'Watched' : 'Mark as watched'}
      </button>
      {dateLabel && (
        <span className="font-body text-xs text-secondary">{dateLabel}</span>
      )}
    </div>
  )
}
