# Work2Wish production deployment requirements

The code now uses same-origin `/api/*` requests with `no-store` caching, refreshes an expired Supabase access token once, and forces the catch-all API route to execute dynamically on Vercel.

## Required Vercel environment variables
Add these for **Production**, **Preview**, and **Development** as applicable, then redeploy:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- Other provider keys used by OTP, Razorpay, Resend, and push notifications

Do not expose the Supabase service-role/secret key with a `NEXT_PUBLIC_` prefix.

## Supabase production schema
Run `FIX_SECTION_VERIFICATION_STATUS.sql` in the same Supabase project referenced by Vercel. Confirm that `workers` and `employers` contain the verification/location columns used by the application.

## Google Maps production restriction
The browser key must allow:

- `https://app.work2wish.com/*`
- the current Vercel preview domain when preview testing is required

Enable Maps JavaScript API, Places API, and Geocoding API for that key.

## Deployment procedure

1. Push this folder to the correct GitHub repository.
2. In Vercel, verify the project is connected to that repository and the correct branch.
3. Verify Root Directory points to the folder containing this `package.json`.
4. Redeploy without build cache once.
5. Open `/api/health` on the deployed domain; it must return JSON with `ok: true`.
6. Sign out, clear site data for `app.work2wish.com`, and sign in again after the first corrected deployment.
