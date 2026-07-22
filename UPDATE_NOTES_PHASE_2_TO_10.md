# Work2Wish Phase 2-10 Update Notes

Updated from the PDF roadmap:

- Worker profile expanded with gender, experience level, languages known, availability, bank account, UPI, selfie verification, skill certificate, references, and trust badges.
- Employer profile expanded with HR contact, official email, company size, GST/PAN, office address, and document verification support.
- Job posting expanded with skill needed, accommodation, food, urgent hiring, overtime, transportation, workers needed, shift, experience and contact number.
- Chat upgraded with WhatsApp-style profile photo beside messages, edit message, delete for me, and delete for everyone.
- Chat stays in a fixed white layout and keeps old working API flow.
- Added Supabase SQL file: `supabase_schema_phase2_to_10.sql`.

## Important
Run `supabase_schema_phase2_to_10.sql` once in Supabase SQL Editor to permanently save the new Phase 2-10 fields.

The app also has fallback logic, so old tables will not break basic profile/job posting if some new columns are not added yet.
