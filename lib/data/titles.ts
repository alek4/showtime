import { createClient } from '@/lib/supabase/server'
import type { Title, NewTitle } from '@/lib/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function buildLetterboxdUrl(title: string, year: number): string {
  const query = `${title} ${year}`
  return `https://letterboxd.com/search/films/${encodeURIComponent(query).replace(/%20/g, '+')}`
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getTitles(): Promise<Title[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('titles')
    .select('*')
    .is('removed_at', null)
    .order('added_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getTitleById(id: string): Promise<Title | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('titles')
    .select('*')
    .eq('id', id)
    .is('removed_at', null)
    .single()
  if (error?.code === 'PGRST116') return null
  if (error) throw error
  return data
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function addTitle(input: NewTitle): Promise<Title> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('titles')
    .insert({ ...input, watched: false })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function softDeleteTitle(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('titles')
    .update({ removed_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function markWatched(id: string, watchedAt?: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('titles')
    .update({ watched: true, watched_at: watchedAt ?? new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function unmarkWatched(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('titles')
    .update({ watched: false, watched_at: null })
    .eq('id', id)
  if (error) throw error
}

export async function updateRuntime(id: string, runtimeMinutes: number): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('titles')
    .update({ runtime_minutes: runtimeMinutes })
    .eq('id', id)
  if (error) throw error
}
