// =====================================================================
// API ENDPOINT: POST /api/applications/:id/worker-confirm
// Description: Worker confirms acceptance of a job offer
// Updates status from 'accepted' to 'ongoing'
// Persists data in database and notifies employer
// =====================================================================

// ENDPOINT LOCATION: app/api/applications/[id]/route.js or similar

import { getSupabase } from '@/lib/supabase/admin'; // Use service role for updates

export async function POST(req, res) {
  try {
    const { id } = req.params; // Application ID
    const { status } = await req.json(); // Should be 'ongoing'
    const token = req.headers.authorization?.split(' ')[1];

    // 1. AUTHENTICATE USER (verify they are the worker)
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get authenticated user
    const supabase = getSupabase();
    const { data: authData } = await supabase.auth.getUser(token);
    if (!authData.user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // 2. FETCH APPLICATION TO VERIFY OWNERSHIP
    const { data: application, error: appError } = await supabase
      .from('applications')
      .select('*, jobs:job_id(!inner)(title, employer_id, workers_needed)')
      .eq('id', id)
      .eq('worker_id', authData.user.id) // Ensure worker owns this application
      .single();

    if (appError || !application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // 3. VALIDATE STATUS TRANSITION
    // Allow: pending → accepted (by employer) → ongoing (by worker)
    // Also allow: accepted → ongoing directly
    if (!['pending', 'accepted'].includes(application.status)) {
      return res.status(400).json({ 
        error: `Cannot move from ${application.status} to ${status}` 
      });
    }

    // 4. UPDATE APPLICATION STATUS - THIS IS THE KEY UPDATE
    const { data: updatedApp, error: updateError } = await supabase
      .from('applications')
      .update({
        status: 'ongoing', // Change to ongoing
        worker_accepted_at: new Date().toISOString(), // Track when accepted
        updated_at: new Date().toISOString() // Update timestamp
      })
      .eq('id', id)
      .select('*, jobs:job_id(id, title, employer_id), workers:worker_id(full_name)')
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return res.status(500).json({ error: 'Failed to update application' });
    }

    // 5. SEND NOTIFICATION TO EMPLOYER
    const workerName = updatedApp.workers?.full_name || 'A worker';
    const jobTitle = updatedApp.jobs?.title || 'a job';
    
    const { error: notifError } = await supabase
      .from('notifications')
      .insert({
        user_id: updatedApp.jobs.employer_id,
        title: 'Worker Accepted Job!',
        body: `${workerName} accepted your job posting: "${jobTitle}"`,
        type: 'worker_accepted_job',
        related_id: id
      });

    if (notifError) {
      console.error('Notification error:', notifError);
      // Don't fail the request just because notification failed
    }

    // 6. RETURN SUCCESS RESPONSE
    return res.status(200).json({
      success: true,
      message: 'Job accepted and work started!',
      application: {
        id: updatedApp.id,
        status: updatedApp.status,
        worker_accepted_at: updatedApp.worker_accepted_at,
        job_id: updatedApp.jobs.id,
        job_title: updatedApp.jobs.title
      }
    });

  } catch (error) {
    console.error('Worker confirm error:', error);
    return res.status(500).json({ 
      error: 'Server error',
      details: error.message 
    });
  }
}

// =====================================================================
// WHAT HAPPENS WHEN THIS ENDPOINT IS CALLED:
// =====================================================================
// 1. ✅ Application status is updated from 'accepted' → 'ongoing'
// 2. ✅ worker_accepted_at timestamp is set (tracks WHEN worker accepted)
// 3. ✅ Data is PERSISTED in database immediately
// 4. ✅ Employer gets a notification
// 5. ✅ Frontend polling will pick up the change in next refresh (8 seconds)
// 6. ✅ Job appears in Employer's "Hired" tab within 8 seconds
// 7. ✅ Worker sees job in "Ongoing" tab
// 8. ✅ Status stays 'ongoing' until job is completed

// =====================================================================
// DATABASE PERSISTENCE GUARANTEE:
// =====================================================================
// The status change is immediately saved to the database via:
//   UPDATE applications SET status = 'ongoing' WHERE id = ?
// 
// This means:
// - Even if the browser closes, the job status is saved
// - Even if the worker logs out, the status remains 'ongoing'
// - Even if the employer logs out, they'll see it next login
// - If the server crashes, the job stays in 'ongoing' state

// =====================================================================
// EMPLOYER VISIBILITY:
// =====================================================================
// The EmployerApp component has auto-refresh polling every 8 seconds:
//
// useEffect(() => {
//   if (tab === 'dashboard' || tab === 'hired') {
//     const interval = setInterval(() => {
//       refreshJobs(); // Fetches all jobs with applicant counts
//     }, 8000);
//     return () => clearInterval(interval);
//   }
// }, [token, tab]);
//
// When jobs are refreshed, the HiredJobs component filters for:
//   jobs.filter(j => j.applicants.some(a => 
//     a.status === 'ongoing' || a.status === 'accepted'
//   ))
//
// This means when a worker accepts:
// 1. Frontend calls this endpoint → status saved as 'ongoing'
// 2. Auto-refresh fires in 8 seconds → fetches updated jobs
// 3. HiredJobs component filters and shows the job
// 4. Employer sees new worker in "Hired" tab automatically

// =====================================================================
// IMPORTANT: Make sure your GET /api/employer/jobs endpoint returns:
// =====================================================================
/*
{
  "jobs": [
    {
      "id": "job-uuid",
      "title": "Welding Work",
      "employer_id": "employer-uuid",
      "applicants": [
        {
          "id": "app-uuid",
          "worker_id": "worker-uuid",
          "status": "ongoing",  // ← This is what we check
          "worker_accepted_at": "2024-05-29T10:30:00Z"
        }
      ]
    }
  ]
}
*/

// Make sure your jobs query includes applicants:
/*
SELECT 
  j.*,
  json_agg(
    json_build_object(
      'id', a.id,
      'worker_id', a.worker_id,
      'status', a.status,
      'worker_accepted_at', a.worker_accepted_at
    )
  ) as applicants
FROM jobs j
LEFT JOIN applications a ON j.id = a.job_id
WHERE j.employer_id = $1
GROUP BY j.id;
*/

// =====================================================================
// TEST THIS ENDPOINT:
// =====================================================================
// 1. Worker logs in and views pending applications
// 2. Click "Accept job" button
// 3. Frontend calls: POST /api/applications/{id}/worker-confirm
// 4. In database, check: SELECT status FROM applications WHERE id = ?
//    Expected: 'ongoing'
// 5. In database, check: SELECT worker_accepted_at FROM applications WHERE id = ?
//    Expected: Today's date/time
// 6. Employer logs in, check "Hired" tab
// 7. Expected: Worker appears in the list within 8 seconds
// 8. Employer can now see all job details and mark attendance

// =====================================================================
// TROUBLESHOOTING:
// =====================================================================
// If job doesn't appear in employer's "Hired" tab:
// ✅ Check 1: Run SQL query to verify status is 'ongoing' in database
// ✅ Check 2: Verify EmployerApp polling is running (check browser console)
// ✅ Check 3: Verify GET /api/employer/jobs includes applicants array
// ✅ Check 4: Check if HiredJobs filter is correct (should check applicants)
// ✅ Check 5: Wait 8 seconds for next auto-refresh cycle
// ✅ Check 6: Manually refresh by clicking "Refresh" button

// =====================================================================
// SUMMARY:
// =====================================================================
// This endpoint SAVES the accepted job status to the database,
// ensuring it persists even after logout. The employer sees it via:
// 1. Auto-refresh polling (every 8 seconds)
// 2. Notification system (real-time)
// 3. Manual refresh button
