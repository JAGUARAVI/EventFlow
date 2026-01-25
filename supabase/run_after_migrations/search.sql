create or replace function public.search_profiles(q text)
returns table (
  id uuid,
  display_name text,
  email text
)
language sql
as $$
  select id, display_name, email
  from public.profiles
  where
    display_name ilike '%' || q || '%'
    or email ilike '%' || q || '%'
    or id::text ilike '%' || q || '%'
  limit 10;
$$;
