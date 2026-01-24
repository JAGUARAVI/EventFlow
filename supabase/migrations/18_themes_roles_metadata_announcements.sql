-- Phase 7.3, 7.6, 7.7, 7.9: Themes, Custom Roles, Metadata Templates, and Announcements
-- Migration 18: Advanced admin features

-- 1. Create themes table
CREATE TABLE themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  name text NOT NULL,
  colors_json jsonb NOT NULL DEFAULT '{}', -- {primary, secondary, accent, neutral, surface, ...}
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT theme_scope CHECK ((user_id IS NOT NULL AND event_id IS NULL) OR (user_id IS NULL AND event_id IS NOT NULL))
);

CREATE INDEX idx_themes_user_id ON themes(user_id);
CREATE INDEX idx_themes_event_id ON themes(event_id);

-- 2. Create custom_roles table
CREATE TABLE custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  permissions jsonb NOT NULL DEFAULT '{}', -- {can_create_events, can_manage_judges, can_export, can_manage_announcements, ...}
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Extend profiles to support custom roles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS custom_role_id uuid REFERENCES custom_roles(id) ON DELETE SET NULL;

-- 4. Create metadata_templates table
CREATE TABLE metadata_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  fields_json jsonb NOT NULL DEFAULT '{}', -- [{name, type, required, options?, ...}, ...]
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id)
);

CREATE INDEX idx_metadata_templates_event_id ON metadata_templates(event_id);

-- 5. Extend teams to support POC and better metadata
ALTER TABLE teams ADD COLUMN IF NOT EXISTS poc_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS description text;

CREATE INDEX idx_teams_poc_user_id ON teams(poc_user_id);

-- 6. Create announcements table
CREATE TABLE announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title text NOT NULL,
  body_markdown text NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_announcements_event_id ON announcements(event_id);
CREATE INDEX idx_announcements_pinned ON announcements(pinned) WHERE pinned = true;

-- 7. Create analytics table
CREATE TABLE event_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  metrics jsonb NOT NULL DEFAULT '{}', -- {pageviews, poll_engagement, match_views, score_velocity, vote_rate, ...}
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_analytics_event_id ON event_analytics(event_id);

-- 8. RLS Policies for themes
ALTER TABLE themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "themes_view_own" ON themes
  FOR SELECT USING (
    user_id = auth.uid() OR is_admin()
  );

CREATE POLICY "themes_manage_own" ON themes
  FOR ALL USING (
    user_id = auth.uid() OR is_admin()
  )
  WITH CHECK (
    user_id = auth.uid() OR is_admin()
  );

-- 9. RLS Policies for custom_roles
ALTER TABLE custom_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "custom_roles_admin_only" ON custom_roles
  FOR ALL USING (is_admin())
  WITH CHECK (is_admin());

-- 10. RLS Policies for metadata_templates
ALTER TABLE metadata_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "metadata_templates_manage_own_event" ON metadata_templates
  FOR ALL USING (
    EXISTS(
      SELECT 1 FROM events
      WHERE events.id = metadata_templates.event_id
      AND (events.created_by = auth.uid() OR is_admin())
    )
  )
  WITH CHECK (
    EXISTS(
      SELECT 1 FROM events
      WHERE events.id = metadata_templates.event_id
      AND (events.created_by = auth.uid() OR is_admin())
    )
  );

-- 11. RLS Policies for announcements
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "announcements_public_read" ON announcements
  FOR SELECT USING (
    EXISTS(
      SELECT 1 FROM events
      WHERE events.id = announcements.event_id
      AND (
        events.visibility = 'public'
        OR events.created_by = auth.uid()
        OR EXISTS(SELECT 1 FROM event_judges WHERE event_judges.event_id = events.id AND event_judges.user_id = auth.uid())
      )
    )
  );

CREATE POLICY "announcements_manage_own_event" ON announcements
  FOR ALL USING (
    EXISTS(
      SELECT 1 FROM events
      WHERE events.id = announcements.event_id
      AND (events.created_by = auth.uid() OR is_admin())
    )
  )
  WITH CHECK (
    EXISTS(
      SELECT 1 FROM events
      WHERE events.id = announcements.event_id
      AND (events.created_by = auth.uid() OR is_admin())
    )
  );

-- 12. RLS Policies for event_analytics
ALTER TABLE event_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "analytics_view_own_event" ON event_analytics
  FOR SELECT USING (
    EXISTS(
      SELECT 1 FROM events
      WHERE events.id = event_analytics.event_id
      AND (events.created_by = auth.uid() OR is_admin())
    )
  );

CREATE POLICY "analytics_manage_own_event" ON event_analytics
  FOR ALL USING (
    EXISTS(
      SELECT 1 FROM events
      WHERE events.id = event_analytics.event_id
      AND (events.created_by = auth.uid() OR is_admin())
    )
  )
  WITH CHECK (
    EXISTS(
      SELECT 1 FROM events
      WHERE events.id = event_analytics.event_id
      AND (events.created_by = auth.uid() OR is_admin())
    )
  );

-- 13. Realtime enable
ALTER PUBLICATION supabase_realtime ADD TABLE themes;
ALTER PUBLICATION supabase_realtime ADD TABLE metadata_templates;
ALTER PUBLICATION supabase_realtime ADD TABLE announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE event_analytics;
