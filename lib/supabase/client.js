'use client';
import { createClient } from '@supabase/supabase-js';

let _client;
export function getSupabase() {
  if (_client) return _client;
  _client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'w2w-auth',
      },
    }
  );
  return _client;
}
