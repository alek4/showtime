'use server'

import { createClient } from '@/lib/supabase/server'
import { addTitle, buildLetterboxdUrl } from '@/lib/data/titles'
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
    runtime_minutes: null,  // not available in search results; user can add via detail page
    genres: genreIdsToNames(movie.genre_ids),
    overview: movie.overview,
    letterboxd_search_url: buildLetterboxdUrl(movie.title, year),
    added_by: user.id,
  }

  try {
    await addTitle(newTitle)
  } catch (err) {
    // Unique constraint violation (Postgres code 23505) — another user already added this
    // title between search and click. Treat as success: the title is in the list.
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === '23505'
    ) {
      return
    }
    throw err
  }
}
