-- =============================================================================
-- 002 · Auto-create public.users row on Supabase Auth signup
--
-- NOT auto-applied. Review, then run this yourself in the Supabase SQL
-- Editor (or via `psql`) against your project.
--
-- Standard Supabase pattern: a SECURITY DEFINER function fires AFTER INSERT
-- on auth.users (which Supabase Auth manages internally on signup) and
-- creates the matching public.users row. This deliberately avoids needing
-- a client-facing INSERT policy on public.users — the function runs with
-- the privileges of its owner (a superuser-ish role in Supabase's setup),
-- bypassing RLS for this one, narrowly-scoped write.
--
-- IMPORTANT — this does NOT match the INSERT template used verbatim by the
-- common tutorial version of this pattern. public.users (see schema.sql)
-- has no `email` column, and its primary key `id` is its own
-- gen_random_uuid() value, distinct from auth.users.id — the link is the
-- separate `auth_id` column. Inserting `new.id` into `id` (as the classic
-- tutorial snippet does) would be wrong for this schema: it would put the
-- auth user's id into public.users' own independent primary key instead of
-- into auth_id, breaking every RLS policy that joins through auth_id ->
-- public.users.id (e.g. user_stash's "Users manage own stash" policy).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (auth_id)
  VALUES (new.id)
  ON CONFLICT (auth_id) DO NOTHING;
  -- ON CONFLICT is a defensive no-op guard (auth_id is UNIQUE) — this
  -- trigger should only ever fire once per signup, but this makes a
  -- re-run of this migration, or any future manual re-trigger, safe
  -- rather than erroring.
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── Verification queries — run these after applying, not part of the migration ───
-- select * from public.users order by created_at desc limit 5;
-- select id, email, created_at from auth.users order by created_at desc limit 5;
