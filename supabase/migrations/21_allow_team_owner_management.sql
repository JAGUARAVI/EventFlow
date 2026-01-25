-- Allow team owners to update their own teams if event is not live
CREATE POLICY "teams_update_own" ON public.teams FOR UPDATE USING (
  auth.uid() = created_by AND 
  EXISTS (
    SELECT 1 FROM public.events e 
    WHERE e.id = teams.event_id 
    AND e.status NOT IN ('live', 'completed', 'archived')
  )
);

-- Allow team owners to delete their own teams if event is not live
CREATE POLICY "teams_delete_own" ON public.teams FOR DELETE USING (
  auth.uid() = created_by AND 
  EXISTS (
    SELECT 1 FROM public.events e 
    WHERE e.id = teams.event_id 
    AND e.status NOT IN ('live', 'completed', 'archived')
  )
);

-- Allow users to register (insert) teams if registration is open
CREATE POLICY "teams_insert_open" ON public.teams FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' AND
  created_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.events e 
    WHERE e.id = event_id 
    AND e.status = 'registration_open'
  )
);
