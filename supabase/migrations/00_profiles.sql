-- Profiles table: extends auth.users with role and profile fields.
-- id matches auth.users(id). Role: admin | club_coordinator | judge | viewer.

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'club_coordinator', 'judge', 'viewer')),
  display_name text,
  avatar_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger: set updated_at on row update
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Optional: auto-create profile on signup (run after RLS is in place, or ensure trigger runs with definer)
-- We add this in a separate migration or here. For idempotency, use DO block or create if not exists.
-- Application can also upsert profile on first login if this trigger is not used.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (NEW.id, 'viewer')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
