# One-time 3-month trial update

Only the trial flow was changed for worker and employer accounts.

- Trial popup is shown only when the account is eligible and has never claimed.
- Choosing Later closes the popup and keeps a Claim Trial button in the top navbar.
- Claiming starts a fixed 90-day trial from the claim timestamp.
- Existing countdown and plan-duration UI continue to use the saved start/end dates.
- A permanent `trial_claim_history` record prevents the same mobile number from receiving another trial after account deletion/recreation.
- When no mobile number exists, normalized email is used as a fallback identity.

Run `TRIAL_CLAIM_HISTORY.sql` once in Supabase before deployment.
