-- Enable RLS on all tables
ALTER TABLE public.allowed_users    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.titles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_title_meta  ENABLE ROW LEVEL SECURITY;

-- allowed_users: users can only see their own membership row
CREATE POLICY "allowed_users_select" ON public.allowed_users
  FOR SELECT USING (auth.uid() = id);

-- titles: full CRUD for users listed in allowed_users
CREATE POLICY "titles_select" ON public.titles
  FOR SELECT USING (auth.uid() IN (SELECT id FROM public.allowed_users));

CREATE POLICY "titles_insert" ON public.titles
  FOR INSERT WITH CHECK (auth.uid() IN (SELECT id FROM public.allowed_users));

CREATE POLICY "titles_update" ON public.titles
  FOR UPDATE USING (auth.uid() IN (SELECT id FROM public.allowed_users));

-- user_title_meta: users can only access their own rows
CREATE POLICY "user_title_meta_select" ON public.user_title_meta
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_title_meta_insert" ON public.user_title_meta
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_title_meta_update" ON public.user_title_meta
  FOR UPDATE USING (auth.uid() = user_id);
