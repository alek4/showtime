'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { addTitle, buildLetterboxdUrl } from '@/lib/data/titles'
import { upsertUserMeta } from '@/lib/data/user-meta'
import { genreIdsToNames, tmdbPosterUrl } from '@/lib/tmdb'
import type { NewTitle } from '@/lib/types'
import type { TMDBMovie } from '@/lib/tmdb'

export async function addTitleAction(movie: TMDBMovie): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const year = movie.release_date
    ? parseInt(movie.release_date.slice(0, 4), 10)
    : new Date().getFullYear()

  const newTitle: NewTitle = {
    tmdb_id: movie.id,
    title: movie.title,
    year,
    poster_url: tmdbPosterUrl(movie.poster_path),
    runtime_minutes: null,
    genres: genreIdsToNames(movie.genre_ids),
    overview: movie.overview,
    letterboxd_search_url: buildLetterboxdUrl(movie.title, year),
    added_by: user.id,
  }

  // titleId is set when we need to update user meta; null means no action needed
  let titleId: string | null = null

  try {
    const inserted = await addTitle(newTitle)
    titleId = inserted.id
  } catch (err) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === '23505'
    ) {
      // Title already exists — check whether it was soft-deleted
      const { data: existing } = await supabase
        .from('titles')
        .select('id, removed_at')
        .eq('tmdb_id', movie.id)
        .single()

      if (existing?.removed_at) {
        // Un-delete: restore to active, reset to unwatched, refresh metadata from TMDB
        const { error } = await supabase
          .from('titles')
          .update({
            removed_at: null,
            watched: false,
            watched_at: null,
            added_by: user.id,
            title: newTitle.title,
            year: newTitle.year,
            poster_url: newTitle.poster_url,
            genres: newTitle.genres,
            overview: newTitle.overview,
            letterboxd_search_url: newTitle.letterboxd_search_url,
          })
          .eq('id', existing.id)
        if (error) throw error
        titleId = existing.id
      }
      // If already active (race condition between two users) — titleId stays null
    } else {
      throw err
    }
  }

  if (titleId) {
    await upsertUserMeta(user.id, titleId, { want_to_watch: true })
    revalidatePath('/')
  }
}
