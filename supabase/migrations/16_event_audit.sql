CREATE TABLE public.event_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  message text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_audit_select"
  ON public.event_audit FOR SELECT
  USING (public.can_see_event(event_id));

CREATE POLICY "event_audit_insert"
  ON public.event_audit FOR INSERT
  WITH CHECK (public.can_manage_event(event_id) OR public.can_judge_event(event_id));
