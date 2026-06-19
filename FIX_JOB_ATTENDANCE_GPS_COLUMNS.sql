-- Adds separate attendance GPS point for job attendance marking.
-- Job location remains the saved company profile location.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS attendance_latitude double precision,
  ADD COLUMN IF NOT EXISTS attendance_longitude double precision,
  ADD COLUMN IF NOT EXISTS attendance_radius_meters integer DEFAULT 20;

UPDATE public.jobs
SET attendance_radius_meters = COALESCE(attendance_radius_meters, 20)
WHERE attendance_radius_meters IS NULL;

NOTIFY pgrst, 'reload schema';
