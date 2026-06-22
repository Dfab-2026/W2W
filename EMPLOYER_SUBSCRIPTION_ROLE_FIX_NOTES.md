# Employer Subscription Role Fix

Updated only the employer subscription role handling.

Fixed:
- Employer subscription no longer fails with `Subscription role mismatch`.
- API now reads the signed-in user's real role from `user_profiles`.
- `subscription/current` now loads employer subscription when the signed-in account is employer.
- `subscription/select` now allows employer plans for employer accounts.

No UI, worker flow, dashboard layout, payment amount, Razorpay plan pricing, jobs, verification, attendance, chat, notification, language, or profile layout changes were made.
