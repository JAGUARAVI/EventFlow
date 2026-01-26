-- RLS policies for eval_panels table
ALTER TABLE public.eval_panels ENABLE ROW LEVEL SECURITY;

-- Anyone can view panels for public events
CREATE POLICY "View panels for public events"
  ON public.eval_panels FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events e 
      WHERE e.id = event_id AND e.visibility = 'public'
    )
  );

-- Event judges/managers/owners can view all panels
CREATE POLICY "Judges can view panels"
  ON public.eval_panels FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events e 
      WHERE e.id = event_id AND public.can_judge_event(e.id)
    )
  );

-- Event managers can create panels
CREATE POLICY "Managers can create panels"
  ON public.eval_panels FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e 
      WHERE e.id = event_id AND public.can_manage_event(e.id)
    )
  );

-- Panel managers can update panels
CREATE POLICY "Panel managers can update"
  ON public.eval_panels FOR UPDATE
  USING (public.can_manage_panel(id));

-- Event managers can delete panels
CREATE POLICY "Managers can delete panels"
  ON public.eval_panels FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.events e 
      WHERE e.id = event_id AND public.can_manage_event(e.id)
    )
  );

-- RLS policies for eval_panel_judges table
ALTER TABLE public.eval_panel_judges ENABLE ROW LEVEL SECURITY;

-- Anyone can view panel judges for public events
CREATE POLICY "View panel judges for public events"
  ON public.eval_panel_judges FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.eval_panels ep
      JOIN public.events e ON ep.event_id = e.id
      WHERE ep.id = panel_id AND e.visibility = 'public'
    )
  );

-- Event judges can view panel judges
CREATE POLICY "Event judges can view panel judges"
  ON public.eval_panel_judges FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.eval_panels ep
      JOIN public.events e ON ep.event_id = e.id
      WHERE ep.id = panel_id AND public.can_judge_event(e.id)
    )
  );

-- Event managers can assign panel judges
CREATE POLICY "Managers can assign panel judges"
  ON public.eval_panel_judges FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.eval_panels ep
      JOIN public.events e ON ep.event_id = e.id
      WHERE ep.id = panel_id AND public.can_manage_event(e.id)
    )
  );

-- Event managers can update panel judge permissions
CREATE POLICY "Managers can update panel judges"
  ON public.eval_panel_judges FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.eval_panels ep
      JOIN public.events e ON ep.event_id = e.id
      WHERE ep.id = panel_id AND public.can_manage_event(e.id)
    )
  );

-- Event managers can remove panel judges
CREATE POLICY "Managers can remove panel judges"
  ON public.eval_panel_judges FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.eval_panels ep
      JOIN public.events e ON ep.event_id = e.id
      WHERE ep.id = panel_id AND public.can_manage_event(e.id)
    )
  );

-- RLS policies for eval_slots table
ALTER TABLE public.eval_slots ENABLE ROW LEVEL SECURITY;

-- Anyone can view slots for public events
CREATE POLICY "View slots for public events"
  ON public.eval_slots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.eval_panels ep
      JOIN public.events e ON ep.event_id = e.id
      WHERE ep.id = panel_id AND e.visibility = 'public'
    )
  );

-- Event judges can view all slots
CREATE POLICY "Event judges can view slots"
  ON public.eval_slots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.eval_panels ep
      JOIN public.events e ON ep.event_id = e.id
      WHERE ep.id = panel_id AND public.can_judge_event(e.id)
    )
  );

-- Team owners can view their own slots
CREATE POLICY "Team owners can view their slots"
  ON public.eval_slots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_id AND t.created_by = auth.uid()
    )
  );

-- Panel judges can create slots
CREATE POLICY "Panel judges can create slots"
  ON public.eval_slots FOR INSERT
  WITH CHECK (public.is_panel_judge(panel_id));

-- Panel judges can update slots
CREATE POLICY "Panel judges can update slots"
  ON public.eval_slots FOR UPDATE
  USING (public.is_panel_judge(panel_id));

-- Panel managers can delete slots
CREATE POLICY "Panel managers can delete slots"
  ON public.eval_slots FOR DELETE
  USING (public.can_manage_panel(panel_id));
