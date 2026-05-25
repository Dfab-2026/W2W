import { createClient } from '@supabase/supabase-js';
let client;
export function getSupabase(){
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'public-anon-key';
  client = createClient(url, key, { auth: { storageKey: 'w2w-auth', persistSession: true, autoRefreshToken: true } });
  return client;
}
