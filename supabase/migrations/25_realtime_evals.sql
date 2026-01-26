-- Enable realtime for evals tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.eval_panels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.eval_slots;

-- Note: eval_panel_judges changes are less frequent, 
-- so we don't add it to realtime to reduce overhead
