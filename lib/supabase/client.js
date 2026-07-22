import { createClient } from '@supabase/supabase-js';

let client;

function getPublicSupabaseConfig() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  ).trim();

  if (!url || !key) {
    throw new Error(
      'Work2Wish configuration is incomplete. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) in Vercel, then redeploy.'
    );
  }

  return { url, key };
}

export function getSupabase() {
  if (client) return client;

  const { url, key } = getPublicSupabaseConfig();

  client = createClient(url, key, {
    auth: {
      storageKey: 'w2w-auth',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return client;
}
