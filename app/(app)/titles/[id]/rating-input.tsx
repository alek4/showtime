'use client'

import { useState, useOptimistic, useTransition } from 'react'
import { upsertMetaAction } from './actions'

type Props = {
  titleId: string
  initialRating: number | null  // stored as 0.5–5.0 in numeric(2,1) DB column
}

// Half-star visual using CSS overflow: the amber star clips to 50% or 100% of
// the background empty star, giving a true half-star appearance.
function StarIcon({ fill }: { fill: 'empty' | 'half' | 'full' }) {
  return (
    <span className="relative inline-block leading-none select-none" aria-hidden="true">
      <span className="text-ghost">★</span>
      <span
        className="absolute inset-0 overflow-hidden text-amber"
        style={{ width: fill === 'full' ? '100%' : fill === 'half' ? '50%' : '0%' }}
      >
        ★
      </span>
    </span>
  )
}

const HALF_VALUES = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const

export function RatingInput({ titleId, initialRating }: Props) {
  const [isPending, startTransition] = useTransition()
  const [optimisticRating, setOptimisticRating] = useOptimistic<number | null>(initialRating)
  const [hoverValue, setHoverValue] = useState<number | null>(null)

  const displayRating = optimisticRating
  const activeValue = hoverValue ?? displayRating

  function getStarFill(starPos: number): 'empty' | 'half' | 'full' {
    if (activeValue === null) return 'empty'
    if (activeValue >= starPos) return 'full'
    if (activeValue >= starPos - 0.5) return 'half'
    return 'empty'
  }

  function handleRate(displayValue: number) {
    // Clicking the exact current value clears the rating
    const newStored = displayRating === displayValue ? null : displayValue
    startTransition(async () => {
      setOptimisticRating(newStored)
      await upsertMetaAction(titleId, { rating: newStored })
    })
  }

  const ratingLabel = hoverValue !== null
    ? `${hoverValue}/5`
    : displayRating !== null
    ? `${displayRating}/5`
    : null

  return (
    <div className="flex items-center gap-3">
      <div
        className="relative flex min-h-[44px] items-center"
        onMouseLeave={() => setHoverValue(null)}
        role="group"
        aria-label="Your rating"
      >
        {/* Display layer — pointer-events-none so clicks reach the overlay */}
        <div className="flex text-3xl pointer-events-none">
          {[1, 2, 3, 4, 5].map(i => (
            <StarIcon key={i} fill={getStarFill(i)} />
          ))}
        </div>

        {/* Click layer: 10 equal-width buttons (left/right half of each star) */}
        <div className="absolute inset-0 flex">
          {HALF_VALUES.map(value => (
            <button
              key={value}
              onClick={() => handleRate(value)}
              onMouseEnter={() => setHoverValue(value)}
              disabled={isPending}
              aria-label={`Rate ${value} star${value !== 1 ? 's' : ''}`}
              className="flex-1 h-full disabled:opacity-40"
            />
          ))}
        </div>
      </div>

      {ratingLabel && (
        <span className="font-body text-xs text-secondary tabular-nums">
          {ratingLabel}
        </span>
      )}
    </div>
  )
}
