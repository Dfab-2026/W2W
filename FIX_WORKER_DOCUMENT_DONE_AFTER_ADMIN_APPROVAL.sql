-- Optional recovery SQL for old worker rows where admin approval is already done
-- but the Worker Documents card still shows Pending/Send for Verification.
-- Run this only if old verified worker document cards are still not showing Done.

update workers
set
  verification_status = 'verified',
  verification_section = 'documents',
  verified_at = coalesce(verified_at, now())
where verified = true
  and coalesce(verification_status, '') <> 'verified';
