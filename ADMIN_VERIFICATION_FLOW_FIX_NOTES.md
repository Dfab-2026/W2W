Admin/profile verification flow patch

Changed only verification-state handling and admin section persistence.

Final behaviour across Worker and Employer cards:
- Red = Send for Verification
- Yellow = Pending Approval
- Green = Done
- After admin section approval, the exact card shows Done.
- After admin final approval, all required cards show Done.
- If user edits a card again, existing modified logic continues to return it to Send for Verification.

Optional SQL included: FIX_SECTION_VERIFICATION_STATUS.sql
