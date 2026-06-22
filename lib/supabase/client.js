import { createClient } from '@supabase/supabase-js';
let client;
export function getSupabase(){
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase env values. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local or Vercel.');
  }

  client = createClient(url, key, { auth: { storageKey: 'w2w-auth', persistSession: true, autoRefreshToken: true } });
  return client;
}
