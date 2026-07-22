-- =====================================================================
-- SQL COMMANDS FOR SAVING AND PERSISTING ACCEPTED JOBS
-- Work2Wish - Employee Acceptance & Status Tracking
-- =====================================================================
-- Run these in Supabase SQL Editor to ensure proper data persistence
-- when workers accept jobs

-- 1. VERIFY APPLICATION STATUS COLUMN
-- (This should already exist from main schema)
-- If not, run:
ALTER TABLE public.applications 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending' 
  CHECK (status in ('pending','accepted','rejected','ongoing','completed'));

-- 2. CREATE INDEX FOR FASTER QUERIES
-- This speeds up filtering jobs by application status
CREATE INDEX IF NOT EXISTS idx_applications_status 
ON public.applications(status);

CREATE INDEX IF NOT EXISTS idx_applications_job_status 
ON public.applications(job_id, status);

CREATE INDEX IF NOT EXISTS idx_applications_worker_status 
ON public.applications(worker_id, status);

-- 3. ADD COLUMN TO TRACK WHEN WORKER ACCEPTED (TIMESTAMP)
ALTER TABLE public.applications 
ADD COLUMN IF NOT EXISTS worker_accepted_at timestamptz;

-- 4. UPDATE EXISTING ONGOING APPLICATIONS TO TRACK WHEN THEY STARTED
UPDATE public.applications 
SET worker_accepted_at = CURRENT_TIMESTAMP 
WHERE status = 'ongoing' AND worker_accepted_at IS NULL;

-- 5. CREATE TRIGGER TO AUTO-UPDATE worker_accepted_at WHEN STATUS CHANGES TO ONGOING
-- First, create the trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION public.set_worker_accepted_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- When status changes to 'ongoing', set the timestamp
  IF NEW.status = 'ongoing' AND (OLD.status IS NULL OR OLD.status != 'ongoing') THEN
    NEW.worker_accepted_at = CURRENT_TIMESTAMP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_worker_accepted_at ON public.applications;

-- Create the trigger
CREATE TRIGGER trigger_worker_accepted_at
BEFORE UPDATE ON public.applications
FOR EACH ROW
EXECUTE FUNCTION public.set_worker_accepted_timestamp();

-- 6. VERIFY THE CONSTRAINT - Applications status values
-- Ensure status enum is properly enforced
ALTER TABLE public.applications 
DROP CONSTRAINT IF EXISTS applications_status_check;

ALTER TABLE public.applications 
ADD CONSTRAINT applications_status_check 
CHECK (status IN ('pending', 'accepted', 'rejected', 'ongoing', 'completed'));

-- 7. QUERY TO GET ALL JOBS WITH HIRED WORKERS
-- This returns all jobs that have workers in 'ongoing' or 'accepted' status
SELECT 
  j.id,
  j.title,
  j.employer_id,
  j.daily_pay,
  j.duration_days,
  j.start_date,
  COUNT(CASE WHEN a.status IN ('ongoing', 'accepted') THEN 1 END) as hired_count,
  COUNT(CASE WHEN a.status = 'ongoing' THEN 1 END) as working_count,
  COUNT(CASE WHEN a.status = 'accepted' THEN 1 END) as waiting_worker_accept_count
FROM public.jobs j
LEFT JOIN public.applications a ON j.id = a.job_id
WHERE (a.status IN ('ongoing', 'accepted', 'completed') OR a.id IS NULL)
GROUP BY j.id, j.title, j.employer_id, j.daily_pay, j.duration_days, j.start_date
HAVING COUNT(CASE WHEN a.status IN ('ongoing', 'accepted', 'completed') THEN 1 END) > 0
ORDER BY j.created_at DESC;

-- 8. QUERY TO GET ACCEPTED BUT NOT YET STARTED APPLICATIONS
-- These are workers who employer accepted but worker hasn't confirmed yet
SELECT 
  a.id,
  a.job_id,
  a.worker_id,
  j.title,
  j.employer_id,
  a.status,
  a.applied_at,
  CASE 
    WHEN a.status = 'accepted' THEN 'Waiting for worker to accept'
    WHEN a.status = 'ongoing' THEN 'Work in progress'
    WHEN a.status = 'completed' THEN 'Completed'
    ELSE a.status 
  END as status_label
FROM public.applications a
JOIN public.jobs j ON a.job_id = j.id
WHERE a.status IN ('accepted', 'ongoing', 'completed')
ORDER BY a.applied_at DESC;

-- 9. UPDATE API ENDPOINT RESPONSE - ENSURE TO RETURN UPDATED STATUS
-- In your Next.js API route at /api/applications/:id/worker-confirm
-- Add this after updating the application:

-- PSEUDO-CODE FOR YOUR API:
/*
POST /api/applications/:id/worker-confirm
{
  // 1. Update the application status
  const { data, error } = await supabase
    .from('applications')
    .update({ 
      status: 'ongoing',
      worker_accepted_at: new Date().toISOString()
    })
    .eq('id', applicationId)
    .select('*, jobs:job_id(*, employers:employer_id(*)), workers:worker_id(*)')
    .single();

  // 2. Fetch the job to get hired count
  const jobsWithHired = await supabase
    .from('jobs')
    .select(`
      *,
      applicants:applications(id, status, worker_id, workers:worker_id(*))
    `)
    .eq('id', data.job_id)
    .single();

  // 3. Send notification to employer
  await supabase
    .from('notifications')
    .insert({
      user_id: jobsWithHired.employer_id,
      title: 'Worker Accepted Job',
      body: `${workerName} accepted your job: ${jobsWithHired.title}`,
      type: 'worker_accepted_job',
      related_id: applicationId
    });

  // 4. Return the updated data
  return {
    status: data.status,
    worker_accepted_at: data.worker_accepted_at,
    job: jobsWithHired,
    message: 'Job accepted successfully'
  };
}
*/

-- 10. QUERY TO VERIFY DATA PERSISTENCE
-- Run this to verify accepted jobs are properly saved
SELECT 
  'Total Applications' as metric,
  COUNT(*) as count
FROM public.applications

UNION ALL

SELECT 'Pending', COUNT(*) FROM public.applications WHERE status = 'pending'
UNION ALL
SELECT 'Accepted (waiting worker)', COUNT(*) FROM public.applications WHERE status = 'accepted'
UNION ALL
SELECT 'Ongoing (in work)', COUNT(*) FROM public.applications WHERE status = 'ongoing'
UNION ALL
SELECT 'Completed', COUNT(*) FROM public.applications WHERE status = 'completed'
UNION ALL
SELECT 'Rejected', COUNT(*) FROM public.applications WHERE status = 'rejected';

-- 11. QUERY TO SEE WORKER ACCEPTANCE TIMELINE
-- Shows when workers accepted jobs
SELECT 
  a.id,
  j.title,
  a.applied_at as "Applied on",
  a.worker_accepted_at as "Worker Accepted on",
  EXTRACT(EPOCH FROM (a.worker_accepted_at - a.applied_at)) / 3600 as "Hours to Accept",
  a.status
FROM public.applications a
JOIN public.jobs j ON a.job_id = j.id
WHERE a.status = 'ongoing' AND a.worker_accepted_at IS NOT NULL
ORDER BY a.worker_accepted_at DESC
LIMIT 20;

-- 12. CLEANUP: RESET TIMESTAMP IF NEEDED (use with caution)
-- If a worker rejects after accepting, reset the timestamp
UPDATE public.applications 
SET worker_accepted_at = NULL 
WHERE status = 'rejected' AND worker_accepted_at IS NOT NULL;

-- 13. ENABLE ROW LEVEL SECURITY POLICIES (if not already done)
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- Policy: Workers can see their own applications
DROP POLICY IF EXISTS "applications_worker_select" ON public.applications;
CREATE POLICY "applications_worker_select" ON public.applications
  FOR SELECT USING (worker_id = auth.uid());

-- Policy: Employers can see applications for their jobs
DROP POLICY IF EXISTS "applications_employer_select" ON public.applications;
CREATE POLICY "applications_employer_select" ON public.applications
  FOR SELECT USING (
    job_id IN (SELECT id FROM public.jobs WHERE employer_id = auth.uid())
  );

-- Policy: Workers can update their own application status
DROP POLICY IF EXISTS "applications_worker_update" ON public.applications;
CREATE POLICY "applications_worker_update" ON public.applications
  FOR UPDATE USING (worker_id = auth.uid())
  WITH CHECK (worker_id = auth.uid());

-- Policy: Employers can update applications for their jobs
DROP POLICY IF EXISTS "applications_employer_update" ON public.applications;
CREATE POLICY "applications_employer_update" ON public.applications
  FOR UPDATE USING (
    job_id IN (SELECT id FROM public.jobs WHERE employer_id = auth.uid())
  )
  WITH CHECK (
    job_id IN (SELECT id FROM public.jobs WHERE employer_id = auth.uid())
  );

-- 14. VIEW FOR EMPLOYER DASHBOARD - HIRED JOBS
-- Create a view to easily get all jobs with hired workers
CREATE OR REPLACE VIEW public.employer_hired_jobs AS
SELECT 
  j.id,
  j.title,
  j.description,
  j.daily_pay,
  j.duration_days,
  j.start_date,
  j.location_text,
  j.employer_id,
  j.status as job_status,
  j.created_at,
  COUNT(a.id) as total_applicants,
  SUM(CASE WHEN a.status = 'pending' THEN 1 ELSE 0 END) as pending_count,
  SUM(CASE WHEN a.status = 'accepted' THEN 1 ELSE 0 END) as accepted_count,
  SUM(CASE WHEN a.status = 'ongoing' THEN 1 ELSE 0 END) as ongoing_count,
  SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) as completed_count,
  SUM(CASE WHEN a.status IN ('ongoing', 'accepted', 'completed') THEN 1 ELSE 0 END) as hired_count,
  json_agg(
    json_build_object(
      'id', a.id,
      'worker_id', a.worker_id,
      'status', a.status,
      'applied_at', a.applied_at,
      'worker_accepted_at', a.worker_accepted_at
    )
    ORDER BY a.applied_at DESC
  ) FILTER (WHERE a.status IN ('ongoing', 'accepted', 'completed')) as hired_applicants
FROM public.jobs j
LEFT JOIN public.applications a ON j.id = a.job_id
GROUP BY j.id, j.title, j.description, j.daily_pay, j.duration_days, j.start_date, j.location_text, j.employer_id, j.status, j.created_at;

-- Grant access to the view
GRANT SELECT ON public.employer_hired_jobs TO authenticated;

-- =====================================================================
-- SUMMARY OF CHANGES:
-- =====================================================================
-- 1. ✅ Ensures 'ongoing' status is properly saved in database
-- 2. ✅ Adds indexes for faster queries on status
-- 3. ✅ Tracks when worker accepted (worker_accepted_at timestamp)
-- 4. ✅ Auto-updates timestamp when status changes to 'ongoing'
-- 5. ✅ Enforces status constraints
-- 6. ✅ Provides query to get all jobs with hired workers
-- 7. ✅ Enables RLS policies for security
-- 8. ✅ Creates view for employer dashboard
-- 
-- RESULT: When worker accepts a job:
-- - Status changes from 'accepted' → 'ongoing'
-- - worker_accepted_at timestamp is set
-- - Employer's hired tab immediately shows the job (via polling)
-- - Job persists in 'ongoing' state until completion
-- =====================================================================
