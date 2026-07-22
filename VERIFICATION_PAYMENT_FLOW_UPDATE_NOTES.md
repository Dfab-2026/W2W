# Verification + Payment Flow Update

Updated only the requested flows:

- All profile verification buttons use strict matching states:
  - Send for Verification = red
  - Pending Approval = yellow
  - Done = green
- Admin final verify now writes section verification logs for all common profile cards.
- Section state no longer force-marks unrelated cards as Done just because global account verification is true.
- If a card is updated after Done, it returns to Send for Verification.
- Completed job payment popup now supports:
  - Manual Payment
  - UPI / GPay with worker UPI ID and QR
  - Mark UPI Paid
- Duplicate apply clean message remains unchanged.

Everything else was left unchanged.
