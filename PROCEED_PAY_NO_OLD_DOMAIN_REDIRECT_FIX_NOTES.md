# Proceed to Pay old domain redirect fix

Updated only the Razorpay Proceed to Pay action.

Change made:
- Removed the automatic redirect from Vercel preview domain to `https://work2wish.com` before opening Razorpay.
- Razorpay checkout now opens from the same URL where the app is deployed and currently running.
- This prevents users from being navigated to the old Work2Wish website when clicking Proceed to Pay.

Important production note:
- To avoid Razorpay website mismatch on mobile, add the exact deployed Vercel URL and/or the final custom domain in Razorpay registered website settings.
