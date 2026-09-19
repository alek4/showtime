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
      className={`inline-flex items-center gap-2 font-body text-sm px-4 py-2 rounded-full min-h-[44px] self-start transition-colors disabled:opacity-40 ${
        optimistic
          ? 'bg-amber/15 text-amber border border-amber/40'
          : 'text-ghost border border-rim hover:text-secondary hover:border-secondary/60'
      }`}
    >
      {isPending ? '…' : optimistic ? '♥ In my list' : '♡ Want to watch'}
    </button>
  )
}
