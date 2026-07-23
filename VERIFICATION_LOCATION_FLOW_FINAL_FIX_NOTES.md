# Verification and Location Flow Final Fix

- Worker and employer section submission keeps the immediate red -> yellow UI transition without a page refresh.
- Section workflow writes now tolerate older Supabase schemas by retrying after removing only columns that are unavailable. Activity logs remain the fallback source for Pending/Done state.
- Worker and employer location saving no longer writes `verification_status = not_submitted` or a fake `location` verification section. This prevents enum/check-constraint failures and prevents location saves from resetting verification cards.
- Saved locations persist `location_text`, latitude, longitude, place ID, and place name without changing unrelated profile state.
- Existing UI and unrelated application behavior are unchanged.

For full database-backed section flags, run `FIX_SECTION_VERIFICATION_STATUS.sql` once in Supabase SQL Editor.
