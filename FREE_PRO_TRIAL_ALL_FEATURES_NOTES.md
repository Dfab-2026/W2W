# Free Pro Trial All Features Update

Scope changed only for subscription trial access.

- New worker accounts keep Free Pro Trial for 3 months.
- New employer accounts keep Free Pro Trial for 3 months.
- During the 3-month trial, Trial unlocks the full highest-plan feature set:
  - Worker trial = Premium feature access.
  - Employer trial = Enterprise feature access.
- Subscription labels now clearly show Free Pro Trial - All Features.
- Trial plan aliases such as `Free Pro Trial`, `free_trial`, and `free_pro_trial` are normalized to `Trial` so feature gates do not fall back to Free.
- After trial expiry, existing expiry logic still asks the user to subscribe.

No worker dashboard UI, employer dashboard UI, admin panel UI, job flow, verification flow, Razorpay flow, document flow, or profile logic was changed.
