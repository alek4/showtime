'use client'

import { useOptimistic, useTransition } from 'react'
import { upsertMetaAction } from './actions'

type Props = {
  titleId: string
  initialValue: boolean
}

export function WantToWatchToggle({ titleId, initialValue }: Props) {
  const [isPending, startTransition] = useTransition()
  const [optimistic, setOptimistic] = useOptimistic(initialValue)

  function handleToggle() {
    const next = !optimistic
    startTransition(async () => {
      setOptimistic(next)
      await upsertMetaAction(titleId, { want_to_watch: next })
    })
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={`font-body text-sm px-4 py-2 rounded min-h-[44px] transition-colors disabled:opacity-40 ${
        optimistic
          ? 'bg-amber text-void'
          : 'bg-surface text-secondary border border-rim hover:border-amber/50'
      }`}
    >
      {isPending ? 'Saving…' : optimistic ? '★ Want to watch' : '+ Want to watch'}
    </button>
  )
}
