import { NextResponse } from 'next/server';
import { getAdmin, getUserFromRequest } from '@/lib/supabase/admin';
import { Resend } from 'resend';

const json = (data, status = 200) => NextResponse.json(data, { status });
const err  = (message, status = 400) => NextResponse.json({ error: message }, { status });

async function sendEmail({ to, subject, html }) {
  try {
    if (!process.env.RESEND_API_KEY) return;
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: 'Work2Wish <onboarding@resend.dev>',
      to: [to],
      subject,
      html,
    });
  } catch (e) {
    console.warn('Resend email failed:', e?.message);
  }
}

async function notify(admin, userId, title, body, type, relatedId) {
  try {
    await admin.from('notifications').insert({
      user_id: userId, title, body, type, related_id: relatedId || null,
    });
  } catch (e) { console.warn('notify failed', e?.message); }
}

// Generate a unique 6-digit login_id, retrying on collision.
async function generateLoginId(admin) {
  for (let i = 0; i < 8; i++) {
    const id = String(Math.floor(100000 + Math.random() * 900000));
    const { data } = await admin.from('user_profiles').select('id').eq('login_id', id).maybeSingle();
    if (!data) return id;
  }
  return String(Date.now()).slice(-6);
}

function otpEmailHtml(code, name) {
  return `
  <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#f8fafc">
    <div style="background:linear-gradient(135deg,#4f46e5,#10b981);color:white;padding:28px;border-radius:16px;text-align:center">
      <div style="font-size:14px;opacity:.85">Work2Wish</div>
      <div style="font-size:22px;font-weight:700;margin-top:6px">Verify your email</div>
    </div>
    <div style="background:white;padding:28px;border-radius:16px;margin-top:-12px;box-shadow:0 4px 16px rgba(0,0,0,.06)">
      <p style="font-size:15px;color:#0f172a">Hi ${name || 'there'},</p>
      <p style="font-size:15px;color:#475569">Use this code to verify your email and finish creating your account:</p>
      <div style="font-size:32px;letter-spacing:10px;font-weight:800;background:#eef2ff;color:#4338ca;padding:18px;border-radius:12px;text-align:center;margin:20px 0">${code}</div>
      <p style="font-size:13px;color:#94a3b8">This code expires in 10 minutes. If you didn't request it, ignore this email.</p>
    </div>
    <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:16px">© Work2Wish</p>
  </div>`;
}

async function route(request, { params }) {
  const path = (params?.path || []).join('/');
  const method = request.method;
  const admin = getAdmin();

  try {
    // ---------- Health ----------
    if (path === '' || path === 'health') {
      return json({ ok: true, app: 'Work2Wish', time: Date.now() });
    }

    // ---------- Public: app downloads tracking ----------
    if (path === 'app-downloads' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const platform = body.platform || 'web';
      const ua = request.headers.get('user-agent') || '';
      await admin.from('app_downloads').insert({ platform, user_agent: ua });
      return json({ ok: true });
    }

    // ---------- AUTH ----------
    // STEP 1: send OTP. We hold the pending signup data in otp_codes.payload.
    if (path === 'auth/send-otp' && method === 'POST') {
      const { email, password, role, full_name } = await request.json();
      if (!email || !password || !role) return err('email, password, role required', 400);
      if (!['worker', 'employer'].includes(role)) return err('Invalid role', 400);

      // Reject if email already has an auth user
      const { data: existing } = await admin.from('user_profiles').select('id').eq('email', email).maybeSingle();
      if (existing) return err('An account with this email already exists. Please log in.', 409);

      // Generate 6-digit OTP
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      // Invalidate previous OTPs for the email
      await admin.from('otp_codes').update({ consumed: true })
        .eq('email', email).eq('consumed', false);

      const { error: insErr } = await admin.from('otp_codes').insert({
        email, code, expires_at,
        payload: { role, full_name, password },
      });
      if (insErr) return err(insErr.message, 400);

      // Send via Resend
      sendEmail({
        to: email,
        subject: `Your Work2Wish code: ${code}`,
        html: otpEmailHtml(code, full_name),
      });

      return json({ ok: true, expires_at });
    }

    // STEP 2: verify OTP -> create user, return session.
    if (path === 'auth/verify-otp' && method === 'POST') {
      const { email, otp } = await request.json();
      if (!email || !otp) return err('email and otp required', 400);

      const { data: row } = await admin.from('otp_codes').select('*')
        .eq('email', email).eq('consumed', false)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();

      if (!row) return err('No pending verification. Please request a new code.', 400);
      if (row.payload?.type === 'reset') return err('This code is for password reset, not signup.', 400);
      if (new Date(row.expires_at) < new Date()) return err('Code expired. Request a new one.', 400);
      if (row.attempts >= 5) return err('Too many attempts. Request a new code.', 400);

      if (String(row.code) !== String(otp)) {
        await admin.from('otp_codes').update({ attempts: row.attempts + 1 }).eq('id', row.id);
        return err('Invalid code', 400);
      }

      // Mark consumed
      await admin.from('otp_codes').update({ consumed: true }).eq('id', row.id);

      const { role, full_name, password } = row.payload || {};
      // Create user
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { role, full_name },
      });
      if (cErr) return err(cErr.message, 400);
      const user = created.user;
      const login_id = await generateLoginId(admin);

      await admin.from('user_profiles').insert({
        id: user.id,
        email,
        role,
        full_name: full_name || null,
        login_id,
      });
      if (role === 'worker') {
        await admin.from('workers').insert({ user_id: user.id });
      } else {
        await admin.from('employers').insert({ user_id: user.id });
      }

      // Sign in
      const supaAnon = (await import('@supabase/supabase-js')).createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );
      const { data: signed, error: sErr } = await supaAnon.auth.signInWithPassword({ email, password });
      if (sErr) return err(sErr.message, 400);

      await sendEmail({
        to: email,
        subject: 'Welcome to Work2Wish',
        html: `
          <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f8fafc">
            <div style="background:#4f46e5;color:#ffffff;padding:24px;border-radius:16px;text-align:center">
              <h1 style="margin:0;font-size:24px;">Welcome to Work2Wish</h1>
            </div>
            <div style="background:#ffffff;padding:24px;border-radius:16px;box-shadow:0 8px 24px rgba(15,23,42,0.08);margin-top:-16px">
              <p style="font-size:16px;color:#0f172a;margin:0 0 16px;">Hi ${full_name || 'there'},</p>
              <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 16px;">Your ${role} account has been created successfully. You can now sign in using your email address or your unique Work2Wish login ID.</p>
              <p style="font-size:15px;color:#334155;line-height:1.7;margin:0 0 12px;">Login ID:</p>
              <div style="font-size:22px;font-weight:700;color:#4f46e5;padding:16px 18px;background:#eef2ff;border-radius:12px;text-align:center;letter-spacing:2px;">${login_id}</div>
              <p style="font-size:14px;color:#64748b;line-height:1.7;margin:18px 0 0;">If you ever need help, reply to this email or visit Work2Wish support.</p>
            </div>
          </div>
        `,
      });

      return json({ user: signed.user, session: signed.session, role, login_id });
    }

    // Resend OTP (signup flow)
    if (path === 'auth/resend-otp' && method === 'POST') {
      const { email } = await request.json();
      if (!email) return err('email required', 400);
      const { data: prev } = await admin.from('otp_codes').select('payload')
        .eq('email', email).eq('consumed', false)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!prev) return err('No pending signup. Start signup again.', 400);

      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await admin.from('otp_codes').update({ consumed: true }).eq('email', email).eq('consumed', false);
      await admin.from('otp_codes').insert({ email, code, expires_at, payload: prev.payload });
      sendEmail({
        to: email,
        subject: `Your Work2Wish code: ${code}`,
        html: otpEmailHtml(code, prev.payload?.full_name),
      });
      return json({ ok: true, expires_at });
    }

    // ===== FORGOT PASSWORD (OTP-based reset) =====
    if (path === 'auth/forgot-password' && method === 'POST') {
      const { email } = await request.json();
      if (!email) return err('email required', 400);
      const { data: prof } = await admin.from('user_profiles').select('id,full_name').eq('email', email).maybeSingle();
      // Always respond 200 to avoid email enumeration; only send mail if exists.
      if (prof) {
        const code = String(Math.floor(100000 + Math.random() * 900000));
        const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        await admin.from('otp_codes').update({ consumed: true })
          .eq('email', email).eq('consumed', false);
        await admin.from('otp_codes').insert({
          email, code, expires_at,
          payload: { type: 'reset', user_id: prof.id, full_name: prof.full_name },
        });
        sendEmail({
          to: email,
          subject: `Work2Wish password reset code: ${code}`,
          html: otpEmailHtml(code, prof.full_name).replace('Verify your email', 'Reset your password'),
        });
      }
      return json({ ok: true });
    }

    if (path === 'auth/reset-password' && method === 'POST') {
      const { email, otp, new_password } = await request.json();
      if (!email || !otp || !new_password) return err('email, otp, new_password required', 400);
      if (new_password.length < 6) return err('Password must be at least 6 characters', 400);

      const { data: row } = await admin.from('otp_codes').select('*')
        .eq('email', email).eq('consumed', false)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!row || row.payload?.type !== 'reset') return err('No pending reset. Request a new code.', 400);
      if (new Date(row.expires_at) < new Date()) return err('Code expired. Request a new one.', 400);
      if (row.attempts >= 5) return err('Too many attempts. Request a new code.', 400);
      if (String(row.code) !== String(otp)) {
        await admin.from('otp_codes').update({ attempts: row.attempts + 1 }).eq('id', row.id);
        return err('Invalid code', 400);
      }

      const userId = row.payload.user_id;
      const { error: uErr } = await admin.auth.admin.updateUserById(userId, { password: new_password });
      if (uErr) return err(uErr.message, 400);

      await admin.from('otp_codes').update({ consumed: true }).eq('id', row.id);

      // Auto sign-in with new password
      const supaAnon = (await import('@supabase/supabase-js')).createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );
      const { data: signed } = await supaAnon.auth.signInWithPassword({ email, password: new_password });
      const { data: profile } = await admin.from('user_profiles').select('*').eq('id', userId).maybeSingle();

      sendEmail({
        to: email,
        subject: 'Your Work2Wish password was reset',
        html: `<p>Your password was just reset. If this wasn't you, contact support immediately.</p>`,
      });

      return json({ ok: true, user: signed?.user, session: signed?.session, role: profile?.role, login_id: profile?.login_id, profile });
    }

    // Legacy direct signup kept for backwards compat (auto-confirm)
    if (path === 'auth/signup' && method === 'POST') {
      const { email, password, role, full_name } = await request.json();
      if (!email || !password || !role) return err('email, password, role required', 400);
      if (!['worker', 'employer'].includes(role)) return err('Invalid role', 400);

      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { role, full_name },
      });
      if (cErr) return err(cErr.message, 400);
      const user = created.user;
      const login_id = await generateLoginId(admin);
      await admin.from('user_profiles').insert({
        id: user.id, email, role, full_name: full_name || null, login_id,
      });
      if (role === 'worker') await admin.from('workers').insert({ user_id: user.id });
      else                   await admin.from('employers').insert({ user_id: user.id });

      const supaAnon = (await import('@supabase/supabase-js')).createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );
      const { data: signed, error: sErr } = await supaAnon.auth.signInWithPassword({ email, password });
      if (sErr) return err(sErr.message, 400);
      return json({ user: signed.user, session: signed.session, role, login_id });
    }

    // OAuth (Google) finalize: after Supabase OAuth completes on the client,
    // the client posts the access_token here so the server can ensure a profile row
    // exists. If no role yet, the client passes role=null and we return needs_role: true.
    if (path === 'auth/oauth-finalize' && method === 'POST') {
      const { access_token, role: chosenRole } = await request.json();
      if (!access_token) return err('access_token required', 400);
      const { data: u } = await admin.auth.getUser(access_token);
      if (!u?.user) return err('Invalid token', 401);
      const user = u.user;
      const { data: profile } = await admin.from('user_profiles').select('*').eq('id', user.id).maybeSingle();
      if (profile) {
        return json({ ok: true, role: profile.role, login_id: profile.login_id, profile });
      }
      // No profile yet — need role
      if (!chosenRole) return json({ needs_role: true, email: user.email, full_name: user.user_metadata?.full_name || user.user_metadata?.name });
      if (!['worker', 'employer'].includes(chosenRole)) return err('Invalid role', 400);

      const login_id = await generateLoginId(admin);
      await admin.from('user_profiles').insert({
        id: user.id,
        email: user.email,
        role: chosenRole,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
        photo_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
        login_id,
      });
      if (chosenRole === 'worker') await admin.from('workers').insert({ user_id: user.id });
      else                          await admin.from('employers').insert({ user_id: user.id });
      return json({ ok: true, role: chosenRole, login_id });
    }

    // LOGIN — accepts email OR 6-digit login_id
    if (path === 'auth/login' && method === 'POST') {
      const { identifier, email, password } = await request.json();
      const idf = (identifier || email || '').trim();
      if (!idf || !password) return err('identifier and password required', 400);

      let resolvedEmail = idf;
      // If looks like a login_id (6 digits) or no '@', try lookup
      if (!idf.includes('@')) {
        const { data: row } = await admin.from('user_profiles').select('email').eq('login_id', idf).maybeSingle();
        if (!row) return err('No account with that login ID', 401);
        resolvedEmail = row.email;
      }

      const supaAnon = (await import('@supabase/supabase-js')).createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );
      const { data: signed, error: sErr } = await supaAnon.auth.signInWithPassword({ email: resolvedEmail, password });
      if (sErr) return err(sErr.message, 401);
      const { data: profile } = await admin.from('user_profiles').select('*').eq('id', signed.user.id).maybeSingle();
      return json({ user: signed.user, session: signed.session, role: profile?.role || 'worker', login_id: profile?.login_id, profile });
    }

    // ---------- Auth required for everything below ----------
    const me = await getUserFromRequest(request);
    if (!me) return err('Unauthorized', 401);

    // ---------- ME / profile ----------
    if (path === 'me' && method === 'GET') {
      const { data: profile } = await admin.from('user_profiles').select('*').eq('id', me.id).maybeSingle();
      let extra = null;
      if (profile?.role === 'worker') {
        const { data } = await admin.from('workers').select('*').eq('user_id', me.id).maybeSingle();
        extra = data;
      } else if (profile?.role === 'employer') {
        const { data } = await admin.from('employers').select('*').eq('user_id', me.id).maybeSingle();
        extra = data;
      }
      return json({ profile, extra });
    }

    if (path === 'me/profile' && method === 'PATCH') {
      const body = await request.json();
      const profileFields = ['full_name', 'phone', 'photo_url'];
      const profileUpdate = {};
      for (const k of profileFields) if (k in body) profileUpdate[k] = body[k];
      if (Object.keys(profileUpdate).length) {
        profileUpdate.updated_at = new Date().toISOString();
        await admin.from('user_profiles').update(profileUpdate).eq('id', me.id);
      }
      const { data: profile } = await admin.from('user_profiles').select('*').eq('id', me.id).maybeSingle();

      const role = profile?.role;
      if (role === 'worker') {
        const wf = ['age', 'skills', 'experience_years', 'expected_daily_wage',
                    'location_text', 'latitude', 'longitude', 'bio', 'available'];
        const wu = {}; for (const k of wf) if (k in body) wu[k] = body[k];
        if (Object.keys(wu).length) await admin.from('workers').update(wu).eq('user_id', me.id);
      } else if (role === 'employer') {
        const ef = ['company_name', 'company_logo', 'industry', 'location_text',
                    'latitude', 'longitude', 'description'];
        const eu = {}; for (const k of ef) if (k in body) eu[k] = body[k];
        if (Object.keys(eu).length) await admin.from('employers').update(eu).eq('user_id', me.id);
      }
      return json({ ok: true });
    }

    // ---------- Jobs ----------
    if (path === 'jobs' && method === 'GET') {
      const url = new URL(request.url);
      const q = url.searchParams.get('q') || '';
      const category = url.searchParams.get('category') || '';
      let qb = admin.from('jobs')
        .select('*, employers!inner(company_name, company_logo, location_text, verified)')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(50);
      if (q) qb = qb.ilike('title', `%${q}%`);
      if (category) qb = qb.eq('category', category);
      const { data, error } = await qb;
      if (error) return err(error.message, 400);
      return json({ jobs: data });
    }

    if (path === 'jobs' && method === 'POST') {
      const body = await request.json();
      // ensure employer
      const { data: profile } = await admin.from('user_profiles').select('role').eq('id', me.id).maybeSingle();
      if (profile?.role !== 'employer') return err('Only employers can post jobs', 403);
      const payload = {
        employer_id: me.id,
        title: body.title, category: body.category, description: body.description,
        location_text: body.location_text, latitude: body.latitude, longitude: body.longitude,
        daily_pay: Number(body.daily_pay) || 0,
        duration_days: Number(body.duration_days) || 1,
        start_date: body.start_date || null,
        status: 'open',
      };
      const { data, error } = await admin.from('jobs').insert(payload).select().single();
      if (error) return err(error.message, 400);
      return json({ job: data });
    }

    if (path.startsWith('jobs/') && !path.includes('/apply') && method === 'GET') {
      const id = path.split('/')[1];
      const { data, error } = await admin.from('jobs')
        .select('*, employers!inner(company_name, company_logo, location_text, description, verified)')
        .eq('id', id).maybeSingle();
      if (error || !data) return err('Job not found', 404);
      return json({ job: data });
    }

    if (path.match(/^jobs\/[^/]+\/apply$/) && method === 'POST') {
      const jobId = path.split('/')[1];
      const body = await request.json().catch(() => ({}));
      const { data: profile } = await admin.from('user_profiles').select('role,full_name,email').eq('id', me.id).maybeSingle();
      if (profile?.role !== 'worker') return err('Only workers can apply', 403);

      const { data: job } = await admin.from('jobs').select('id,title,employer_id').eq('id', jobId).maybeSingle();
      if (!job) return err('Job not found', 404);

      const { data: app, error } = await admin.from('applications').insert({
        job_id: jobId, worker_id: me.id, message: body.message || null,
      }).select().single();
      if (error) return err(error.message, 400);

      // notify employer
      await notify(admin, job.employer_id, 'New applicant',
        `${profile?.full_name || 'A worker'} applied to "${job.title}"`, 'application', app.id);
      // email employer
      const { data: emp } = await admin.from('user_profiles').select('email').eq('id', job.employer_id).maybeSingle();
      if (emp?.email) sendEmail({
        to: emp.email, subject: `New applicant for ${job.title}`,
        html: `<p><b>${profile?.full_name || 'A worker'}</b> applied to your job <b>${job.title}</b>.</p>`,
      });
      return json({ application: app });
    }

    // ---------- Employer routes ----------
    if (path === 'employer/jobs' && method === 'GET') {
      const { data, error } = await admin.from('jobs')
        .select('*, applications(id,status)')
        .eq('employer_id', me.id).order('created_at', { ascending: false });
      if (error) return err(error.message, 400);
      const enriched = (data || []).map(j => ({
        ...j,
        applicants_count: (j.applications || []).length,
        pending_count: (j.applications || []).filter(a => a.status === 'pending').length,
      }));
      return json({ jobs: enriched });
    }

    if (path.match(/^employer\/jobs\/[^/]+\/applicants$/) && method === 'GET') {
      const jobId = path.split('/')[2];
      const { data, error } = await admin.from('applications')
        .select('*, workers!inner(*, user_profiles!workers_user_id_fkey(full_name,email,phone,photo_url))')
        .eq('job_id', jobId).order('applied_at', { ascending: false });
      if (error) return err(error.message, 400);
      return json({ applicants: data });
    }

    if (path.match(/^applications\/[^/]+$/) && method === 'PATCH') {
      const appId = path.split('/')[1];
      const body = await request.json();
      const status = body.status;
      if (!['accepted','rejected','ongoing','completed'].includes(status))
        return err('Invalid status', 400);
      const { data: appRow } = await admin.from('applications').select('*, jobs!inner(employer_id,title)').eq('id', appId).maybeSingle();
      if (!appRow) return err('Application not found', 404);
      if (appRow.jobs.employer_id !== me.id) return err('Forbidden', 403);
      const { data, error } = await admin.from('applications').update({ status }).eq('id', appId).select().single();
      if (error) return err(error.message, 400);
      await notify(admin, appRow.worker_id,
        `Application ${status}`,
        `Your application for "${appRow.jobs.title}" was ${status}.`,
        'application', appId);
      const { data: w } = await admin.from('user_profiles').select('email,full_name').eq('id', appRow.worker_id).maybeSingle();
      if (w?.email) sendEmail({
        to: w.email,
        subject: `Your application was ${status}`,
        html: `<p>Hi ${w.full_name || ''},</p><p>Your application for <b>${appRow.jobs.title}</b> is now <b>${status}</b>.</p>`,
      });
      return json({ application: data });
    }

    // ---------- Worker routes ----------
    if (path === 'worker/applications' && method === 'GET') {
      const { data, error } = await admin.from('applications')
        .select('*, jobs!inner(*, employers!inner(company_name,company_logo,location_text))')
        .eq('worker_id', me.id).order('applied_at', { ascending: false });
      if (error) return err(error.message, 400);
      return json({ applications: data });
    }

    // ---------- Notifications ----------
    if (path === 'notifications' && method === 'GET') {
      const { data } = await admin.from('notifications')
        .select('*').eq('user_id', me.id).order('created_at', { ascending: false }).limit(50);
      return json({ notifications: data || [] });
    }
    if (path.match(/^notifications\/[^/]+\/read$/) && method === 'POST') {
      const id = path.split('/')[1];
      await admin.from('notifications').update({ read: true }).eq('id', id).eq('user_id', me.id);
      return json({ ok: true });
    }

    // ---------- Upload (profile photo / company logo) ----------
    if (path === 'upload' && method === 'POST') {
      const form = await request.formData();
      const file = form.get('file');
      const kind = (form.get('kind') || 'avatar').toString(); // avatar|logo
      if (!file || typeof file === 'string') return err('file required', 400);
      const buf = Buffer.from(await file.arrayBuffer());
      const ext = (file.name?.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      const key = `users/${me.id}/${kind}-${Date.now()}.${ext}`;
      const { error: upErr } = await admin.storage.from('w2w-public').upload(key, buf, {
        contentType: file.type || 'image/jpeg',
        upsert: true,
      });
      if (upErr) return err(upErr.message, 400);
      const { data: pub } = admin.storage.from('w2w-public').getPublicUrl(key);
      return json({ url: pub.publicUrl, path: key });
    }

    // ---------- Chat threads ----------
    if (path === 'chat/threads' && method === 'GET') {
      const { data: profile } = await admin.from('user_profiles').select('role').eq('id', me.id).maybeSingle();
      let peerIds = new Set();
      if (profile?.role === 'worker') {
        const { data } = await admin.from('applications')
          .select('jobs!inner(employer_id)').eq('worker_id', me.id);
        (data || []).forEach(a => a.jobs?.employer_id && peerIds.add(a.jobs.employer_id));
      } else if (profile?.role === 'employer') {
        const { data } = await admin.from('applications')
          .select('worker_id, jobs!inner(employer_id)').eq('jobs.employer_id', me.id);
        (data || []).forEach(a => a.worker_id && peerIds.add(a.worker_id));
      }
      // Also include anyone who has messaged me
      const { data: msgs } = await admin.from('messages')
        .select('sender_id, receiver_id').or(`sender_id.eq.${me.id},receiver_id.eq.${me.id}`);
      (msgs || []).forEach(m => {
        if (m.sender_id !== me.id) peerIds.add(m.sender_id);
        if (m.receiver_id !== me.id) peerIds.add(m.receiver_id);
      });
      const ids = Array.from(peerIds);
      if (ids.length === 0) return json({ threads: [] });

      const { data: peers } = await admin.from('user_profiles')
        .select('id, full_name, email, photo_url, role').in('id', ids);

      // last message per peer + unread count
      const threads = [];
      for (const p of peers || []) {
        const { data: lastArr } = await admin.from('messages').select('*')
          .or(`and(sender_id.eq.${me.id},receiver_id.eq.${p.id}),and(sender_id.eq.${p.id},receiver_id.eq.${me.id})`)
          .order('created_at', { ascending: false }).limit(1);
        const { count: unread } = await admin.from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('sender_id', p.id).eq('receiver_id', me.id).eq('read', false);
        // For employer side, fetch company name; for worker side, no extra
        let extraName = null;
        if (p.role === 'employer') {
          const { data: emp } = await admin.from('employers').select('company_name').eq('user_id', p.id).maybeSingle();
          extraName = emp?.company_name;
        }
        threads.push({
          peer_id: p.id,
          peer_name: extraName || p.full_name || p.email,
          peer_photo: p.photo_url,
          peer_role: p.role,
          last_message: lastArr?.[0] || null,
          unread_count: unread || 0,
        });
      }
      threads.sort((a, b) => new Date(b.last_message?.created_at || 0) - new Date(a.last_message?.created_at || 0));
      return json({ threads });
    }

    // Mark messages from peer as read
    if (path === 'messages/mark-read' && method === 'POST') {
      const { peer_id } = await request.json();
      if (!peer_id) return err('peer_id required', 400);
      await admin.from('messages').update({ read: true })
        .eq('sender_id', peer_id).eq('receiver_id', me.id).eq('read', false);
      return json({ ok: true });
    }

    // ---------- Messages ----------
    if (path === 'messages' && method === 'GET') {
      const url = new URL(request.url);
      const peer = url.searchParams.get('peer');
      if (!peer) return err('peer required', 400);
      const { data } = await admin.from('messages').select('*')
        .or(`and(sender_id.eq.${me.id},receiver_id.eq.${peer}),and(sender_id.eq.${peer},receiver_id.eq.${me.id})`)
        .order('created_at', { ascending: true }).limit(200);
      return json({ messages: data || [] });
    }
    if (path === 'messages' && method === 'POST') {
      const body = await request.json();
      const payload = {
        sender_id: me.id, receiver_id: body.receiver_id,
        content: body.content, job_id: body.job_id || null, application_id: body.application_id || null,
      };
      const { data, error } = await admin.from('messages').insert(payload).select().single();
      if (error) return err(error.message, 400);
      return json({ message: data });
    }

    return err(`Not found: ${method} /${path}`, 404);
  } catch (e) {
    console.error('API error:', e);
    return err(e?.message || 'Server error', 500);
  }
}

export const GET    = route;
export const POST   = route;
export const PATCH  = route;
export const PUT    = route;
export const DELETE = route;
