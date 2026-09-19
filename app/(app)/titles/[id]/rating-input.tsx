'use client'

import { useOptimistic, useTransition } from 'react'
import { upsertMetaAction } from './actions'

type Props = {
  titleId: string
  initialRating: number | null
}

export function RatingInput({ titleId, initialRating }: Props) {
  const [isPending, startTransition] = useTransition()
  const [optimisticRating, setOptimisticRating] = useOptimistic<number | null>(initialRating)

  function handleRate(star: number) {
    const newRating = optimisticRating === star ? null : star
    startTransition(async () => {
      setOptimisticRating(newRating)
      await upsertMetaAction(titleId, { rating: newRating })
    })
  }

  return (
    <div className="flex gap-2" role="group" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          onClick={() => handleRate(star)}
          disabled={isPending}
          aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
          className="text-3xl leading-none min-h-[44px] min-w-[44px] disabled:opacity-40 transition-colors"
        >
          <span
            className={
              optimisticRating !== null && star <= optimisticRating
                ? 'text-amber'
                : 'text-ghost'
            }
          >
            ★
          </span>
        </button>
      ))}
    </div>
  )
}
