'use client'

import { useState, useTransition } from 'react'
import { updateRuntimeAction } from './actions'

type Props = {
  titleId: string
}

export function RuntimeInput({ titleId }: Props) {
  const [value, setValue] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const minutes = parseInt(value, 10)
    if (!Number.isInteger(minutes) || minutes <= 0) return
    startTransition(async () => {
      await updateRuntimeAction(titleId, minutes)
      setValue('')
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-center">
      <input
        type="number"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Runtime (min)"
        min={1}
        className="bg-surface text-primary font-body text-sm rounded px-3 py-2 w-36 focus:outline-none focus:ring-1 focus:ring-amber/50"
      />
      <button
        type="submit"
        disabled={isPending || !value}
        className="font-body text-sm bg-amber text-void px-4 py-2 rounded min-h-[44px] disabled:opacity-40"
      >
        {isPending ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}
