'use client'

import { useRef, useState, useTransition } from 'react'
import { upsertMetaAction } from './actions'

type Props = {
  titleId: string
  initialNote: string | null
}

export function NoteInput({ titleId, initialNote }: Props) {
  const [value, setValue] = useState(initialNote ?? '')
  const [isPending, startTransition] = useTransition()
  const savedRef = useRef(initialNote ?? '')

  function handleBlur() {
    if (value === savedRef.current) return
    startTransition(async () => {
      await upsertMetaAction(titleId, { note: value || null })
      savedRef.current = value
    })
  }

  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={handleBlur}
        placeholder="Add a note…"
        rows={3}
        className="w-full bg-surface text-primary font-body text-sm rounded px-3 py-2 resize-none placeholder:text-ghost focus:outline-none focus:ring-1 focus:ring-amber/50"
      />
      {isPending && (
        <span className="absolute bottom-2 right-2 font-body text-xs text-secondary">
          Saving…
        </span>
      )}
    </div>
  )
}
