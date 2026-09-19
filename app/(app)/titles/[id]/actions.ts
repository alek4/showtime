'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { markWatched, unmarkWatched, softDeleteTitle, updateRuntime } from '@/lib/data/titles'
import { upsertUserMeta } from '@/lib/data/user-meta'
import type { UserMeta, UserMetaUpdate } from '@/lib/types'

export async function toggleWatchedAction(
  titleId: string,
  markAsWatched: boolean
): Promise<void> {
  if (markAsWatched) {
    await markWatched(titleId)
  } else {
    await unmarkWatched(titleId)
  }
  revalidatePath('/titles/[id]', 'page')
  revalidatePath('/')
}

export async function updateRuntimeAction(
  titleId: string,
  runtimeMinutes: number
): Promise<void> {
  await updateRuntime(titleId, runtimeMinutes)
  revalidatePath('/titles/[id]', 'page')
}

export async function softDeleteAction(titleId: string): Promise<void> {
  await softDeleteTitle(titleId)
  redirect('/')
}

export async function upsertMetaAction(
  titleId: string,
  updates: UserMetaUpdate
): Promise<UserMeta> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const result = await upsertUserMeta(user.id, titleId, updates)
  revalidatePath('/titles/[id]', 'page')
  revalidatePath('/')
  return result
}
