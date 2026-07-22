import { createClient } from '@supabase/supabase-js';

let admin;

export function getAdmin() {
  if (admin) return admin;

  const url = (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ''
  ).trim();

  const key = (
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ''
  ).trim();

  if (!url || !key) {
    throw new Error(
      'Server configuration is incomplete. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) in Vercel, then redeploy.'
    );
  }

  admin = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return admin;
}

export async function getUserFromRequest(request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return null;

  const supa = getAdmin();
  const { data, error } = await supa.auth.getUser(token);
  if (error || !data?.user) return null;

  // Attach the Work2Wish profile role to the auth user.
  // This fixes employer subscription flows where API routes need to know
  // whether the signed-in user is a worker or employer.
  try {
    const { data: profile } = await supa
      .from('user_profiles')
      .select('id,email,role,blocked,full_name,company_name')
      .eq('id', data.user.id)
      .maybeSingle();

    return {
      ...data.user,
      role: profile?.role || data.user.user_metadata?.role || data.user.app_metadata?.role || null,
      profile: profile || null,
      blocked: !!profile?.blocked,
    };
  } catch {
    return {
      ...data.user,
      role: data.user.user_metadata?.role || data.user.app_metadata?.role || null,
      profile: null,
    };
  }
}
