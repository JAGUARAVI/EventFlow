-- Enable Realtime for matches (UPDATE only, for live bracket updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
