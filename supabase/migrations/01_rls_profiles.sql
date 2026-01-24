-- Helpers: get_user_role(), is_admin()
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT public.get_user_role() = 'admin';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: own row only
CREATE POLICY "users_select_own_profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

-- INSERT: own row only (for app-side upsert on first login if trigger didn't run)
CREATE POLICY "users_insert_own_profile"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- UPDATE: own row; role change only if is_admin. We allow UPDATE for own row and enforce
-- role change in a trigger (block non-admin from changing role).
CREATE POLICY "users_update_own_profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Trigger: prevent non-admin from changing role
CREATE OR REPLACE FUNCTION public.prevent_role_change_by_non_admin()
RETURNS trigger AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can change role';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_prevent_role_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_change_by_non_admin();
