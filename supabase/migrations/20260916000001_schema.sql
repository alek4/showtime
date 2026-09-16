-- Lookup table: only these two UUIDs can access the app
CREATE TABLE public.allowed_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Shared movie/show library
CREATE TABLE public.titles (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tmdb_id               INTEGER     UNIQUE NOT NULL,
  title                 TEXT        NOT NULL,
  year                  INTEGER     NOT NULL,
  poster_url            TEXT,
  runtime_minutes       INTEGER,
  genres                TEXT[]      NOT NULL DEFAULT '{}',
  overview              TEXT,
  letterboxd_search_url TEXT        NOT NULL,
  watched               BOOLEAN     NOT NULL DEFAULT FALSE,
  watched_at            TIMESTAMPTZ,
  added_by              UUID        NOT NULL REFERENCES auth.users(id),
  added_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  streaming_data        JSONB,
  streaming_cached_at   TIMESTAMPTZ,
  removed_at            TIMESTAMPTZ
);

-- Per-user ratings, notes, and want-to-watch flag
CREATE TABLE public.user_title_meta (
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title_id      UUID        NOT NULL REFERENCES public.titles(id) ON DELETE CASCADE,
  want_to_watch BOOLEAN     NOT NULL DEFAULT FALSE,
  rating        INTEGER     CHECK (rating BETWEEN 1 AND 5),
  note          TEXT,
  rated_at      TIMESTAMPTZ,
  PRIMARY KEY (user_id, title_id)
);
