import { createClient } from '@/lib/supabase/server'
import type { UserMeta, UserMetaUpdate } from '@/lib/types'

export async function upsertUserMeta(
  userId: string,
  titleId: string,
  updates: UserMetaUpdate
): Promise<UserMeta> {
  const supabase = await createClient()

  const payload: Record<string, unknown> = {
    user_id: userId,
    title_id: titleId,
    ...updates,
  }
  if (updates.rating !== undefined) {
    payload.rated_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('user_title_meta')
    .upsert(payload, { onConflict: 'user_id,title_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getUserMeta(
  userId: string,
  titleId: string
): Promise<UserMeta | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_title_meta')
    .select('*')
    .eq('user_id', userId)
    .eq('title_id', titleId)
    .single()
  if (error?.code === 'PGRST116') return null
  if (error) throw error
  return data
}

export async function getAllUserMeta(userId: string): Promise<UserMeta[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_title_meta')
    .select('*')
    .eq('user_id', userId)
  if (error) throw error
  return data ?? []
}
