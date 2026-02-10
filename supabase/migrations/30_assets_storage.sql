-- Migration 30: Public assets storage bucket
-- Creates a Supabase Storage bucket for public assets uploaded by admins/club coordinators.

-- 1. Create the public bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('assets', 'assets', true)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS policies on storage.objects for the 'assets' bucket

-- Anyone can read (public bucket)
CREATE POLICY "assets_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'assets');

-- Only admins and club_coordinators can upload
CREATE POLICY "assets_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'assets'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'club_coordinator')
    )
  );

-- Only admins and club_coordinators can update (replace) their own files
CREATE POLICY "assets_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'assets'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'club_coordinator')
    )
  );

-- Admins can delete any asset; coordinators can delete their own uploads
CREATE POLICY "assets_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'assets'
    AND auth.uid() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
      )
      OR owner = auth.uid()
    )
  );
