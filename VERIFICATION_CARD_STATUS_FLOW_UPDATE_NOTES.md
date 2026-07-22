# Verification card status flow update

Only the worker/employer verification-card workflow was updated.

## Card status flow

1. **Send for Verification** — red
2. **Pending Approval** — yellow after submission
3. **Done** — green after admin approval
4. If approved data is edited, that card returns to **Send for Verification** — red
5. After resubmission, that card returns to **Pending Approval** — yellow

The status is stored separately for each verification section:
- Worker: Profile, Documents, Bank Details
- Employer: Company Profile, Documents

## Supabase requirement

Run `FIX_SECTION_VERIFICATION_STATUS.sql` once in the Supabase SQL Editor if those section-status columns have not already been added.

No other UI, job, chat, payment, subscription, notification, or profile functionality was intentionally changed.
