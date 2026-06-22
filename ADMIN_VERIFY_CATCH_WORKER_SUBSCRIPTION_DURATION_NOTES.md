# Admin Verify Catch + Worker Subscription Duration Fix

Updated only these items:

1. Fixed Supabase admin verification error:
   - Removed invalid `.maybeSingle().catch(...)` usage.
   - Replaced with safe `try/catch` around the awaited query.
   - This fixes: `admin.from(...).select(...).eq(...).maybeSingle(...).catch is not a function`.

2. Worker subscription duration visibility:
   - Worker profile top card now shows active subscription/trial badge.
   - Badge includes remaining days when an expiry date is available.
   - Matches employer-style subscription visibility.

No other UI, flow, profile, payment, admin layout, verification design, or database logic was intentionally changed.

Build note:
- `npm run build` could not be executed in this sandbox because `next` is not installed here.
