# Production Security Notes

This package intentionally does not include real secret values in `.env.local`. Add production secrets only in Vercel Environment Variables or your local private `.env.local`.

Rotate any keys that were pasted into chat or screenshots before launch:
- Supabase service role key
- Razorpay key secret
- Google Maps API key
- 2Factor API key
- VAPID private key

Keep service role keys server-side only. Never expose them in React/client code.
