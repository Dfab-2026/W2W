# Free Trial Claim + Subscription Duration Update

Updated only requested subscription trial behavior:

- New worker/employer users now see a popup to claim the 3 Month Free Pro Trial.
- Trial starts from the claim date, not automatically before claim.
- If user clicks Later / closes popup, the popup will appear again on future visits until they claim.
- After claim, subscription duration card uses the claim date and 3-month expiry.
- Same behavior works for both worker and employer profiles.
- Existing paid plans and all other app flows remain unchanged.

Build note: `node -c app/page.js` passed. `npm run build` could not run in this sandbox because `next` is not installed in node_modules.
