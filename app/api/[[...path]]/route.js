import { NextResponse } from 'next/server';
import { getAdmin, getUserFromRequest } from '@/lib/supabase/admin';
import { Resend } from 'resend';

const json = (data, status = 200) => NextResponse.json(data, { status });
const err  = (message, status = 400) => NextResponse.json({ error: message }, { status });

function distanceMeters(lat1, lon1, lat2, lon2) {
  const aLat = Number(lat1), aLon = Number(lon1), bLat = Number(lat2), bLon = Number(lon2);
  if (![aLat, aLon, bLat, bLon].every(Number.isFinite)) return null;
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

async function sendEmail({ to, subject, html }) {
  try {
    if (!process.env.RESEND_API_KEY) return;
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: 'Work2Wish <work2wish@work2wish.com>',
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

async function logActivity(admin, userId, action, details = {}, actorId = null) {
  try {
    await admin.from('activity_logs').insert({
      user_id: userId,
      actor_id: actorId || userId,
      action,
      details,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    // activity_logs is optional until the SQL in this zip is added. Never block main app flow.
    console.warn('activity log skipped:', e?.message);
  }
}

function isMsg91Configured() {
  return !!process.env.MSG91_AUTH_KEY && !!process.env.MSG91_TEMPLATE_ID;
}

function canUseDevOtpFallback() {
  return process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_OTP === 'true';
}

function normalizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return null;
}

async function sendSmsOtp(phone, code) {
  if (!isMsg91Configured()) {
    if (canUseDevOtpFallback()) {
      console.warn(`DEV OTP for ${phone}: ${code}`);
      return { type: 'success', dev: true };
    }
    throw new Error('SMS OTP is not configured. Add MSG91_AUTH_KEY and MSG91_TEMPLATE_ID in .env.local, or set ALLOW_DEV_OTP=true only for local testing.');
  }

  const cleanPhone = String(phone).replace(/\D/g, '');
  const url = new URL('https://control.msg91.com/api/v5/otp');
  url.searchParams.set('template_id', process.env.MSG91_TEMPLATE_ID);
  url.searchParams.set('mobile', cleanPhone);
  url.searchParams.set('otp', code);

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { authkey: process.env.MSG91_AUTH_KEY },
    cache: 'no-store',
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || (data?.type && data.type !== 'success')) {
    const message = data?.message || data?.errors?.[0] || data?.error || res.statusText;
    throw new Error(`MSG91 OTP send failed: ${message || 'Unknown error'}`);
  }

  return data || { type: 'success' };
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

    // ---------- Authenticated mobile SMS OTP ----------
    if (path === 'auth/mobile-send-otp' && method === 'POST') {
      const me = await getUserFromRequest(request);
      if (!me) return err('Unauthorized', 401);
      const body = await request.json().catch(() => ({}));
      const phone = normalizePhone(String(body.phone || '').trim());
      if (!phone) return err('Enter phone in international format, e.g. +919876543210', 400);

      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      await admin.from('otp_codes').update({ consumed: true }).eq('email', phone).eq('consumed', false);
      const { error } = await admin.from('otp_codes').insert({
        email: phone,
        code,
        attempts: 0,
        expires_at,
        payload: { type: 'mobile', user_id: me.id, phone, provider: 'msg91' },
      });
      if (error) return err(error.message, 400);
      await sendSmsOtp(phone, code);
      return json({ ok: true, expires_at, dev_otp: canUseDevOtpFallback() ? code : undefined });
    }

    if (path === 'auth/mobile-verify-otp' && method === 'POST') {
      const me = await getUserFromRequest(request);
      if (!me) return err('Unauthorized', 401);
      const body = await request.json().catch(() => ({}));
      const phone = normalizePhone(String(body.phone || '').trim());
      const otp = String(body.otp || '').trim();
      if (!phone) return err('Enter phone in international format, e.g. +919876543210', 400);
      if (!otp) return err('Enter OTP', 400);

      const { data: row } = await admin.from('otp_codes').select('*')
        .eq('email', phone).eq('consumed', false).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!row) return err('Invalid or expired OTP', 400);
      if (row.expires_at && new Date(row.expires_at) < new Date()) {
        await admin.from('otp_codes').update({ consumed: true }).eq('id', row.id);
        return err('OTP expired', 400);
      }
      if ((row.attempts || 0) >= 5) return err('Too many attempts. Request a new OTP.', 400);
      if (String(row.code) !== String(otp)) {
        await admin.from('otp_codes').update({ attempts: (row.attempts || 0) + 1 }).eq('id', row.id);
        return err('Invalid OTP', 400);
      }
      await admin.from('otp_codes').update({ consumed: true }).eq('id', row.id);
      await admin.from('user_profiles').update({ phone, updated_at: new Date().toISOString() }).eq('id', me.id);
      const { data: profile } = await admin.from('user_profiles').select('role').eq('id', me.id).maybeSingle();
      if (profile?.role === 'worker') {
        await admin.from('workers').update({ mobile_verified: true }).eq('user_id', me.id);
      } else if (profile?.role === 'employer') {
        await admin.from('employers').update({ mobile_verified: true }).eq('user_id', me.id);
      }
      return json({ ok: true, mobile_verified: true });
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
      if (profile?.blocked) return err('Your account has been blocked by admin.', 403);

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
        if (profile.blocked) return err('Your account has been blocked by admin.', 403);
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


    // Google signup OTP: used when a new Google user completes the normal Create Account flow.
    if (path === 'auth/google-send-otp' && method === 'POST') {
      const { email, password, role, full_name, google_access_token } = await request.json();
      if (!email || !password || !role || !google_access_token) {
        return err('email, password, role, google_access_token required', 400);
      }
      if (!['worker', 'employer'].includes(role)) return err('Invalid role', 400);

      const { data: u } = await admin.auth.getUser(google_access_token);
      if (!u?.user) return err('Invalid Google session', 401);
      if (u.user.email !== email) return err('Google email mismatch', 400);

      const { data: existing } = await admin.from('user_profiles').select('id').eq('email', email).maybeSingle();
      if (existing) return err('An account with this email already exists. Please log in.', 409);

      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      await admin.from('otp_codes').update({ consumed: true })
        .eq('email', email).eq('consumed', false);

      const { error: insErr } = await admin.from('otp_codes').insert({
        email,
        code,
        expires_at,
        payload: {
          type: 'google_signup',
          user_id: u.user.id,
          role,
          full_name,
          password,
          photo_url: u.user.user_metadata?.avatar_url || u.user.user_metadata?.picture || null,
        },
      });
      if (insErr) return err(insErr.message, 400);

      await sendEmail({
        to: email,
        subject: `Your Work2Wish code: ${code}`,
        html: otpEmailHtml(code, full_name),
      });

      return json({ ok: true, expires_at });
    }

    if (path === 'auth/google-verify-otp' && method === 'POST') {
      const { email, otp, google_access_token } = await request.json();
      if (!email || !otp || !google_access_token) {
        return err('email, otp, google_access_token required', 400);
      }

      const { data: u } = await admin.auth.getUser(google_access_token);
      if (!u?.user) return err('Invalid Google session', 401);
      if (u.user.email !== email) return err('Google email mismatch', 400);

      const { data: row } = await admin.from('otp_codes').select('*')
        .eq('email', email).eq('consumed', false)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();

      if (!row || row.payload?.type !== 'google_signup') {
        return err('No pending Google signup. Please request a new code.', 400);
      }
      if (new Date(row.expires_at) < new Date()) return err('Code expired. Request a new one.', 400);
      if (row.attempts >= 5) return err('Too many attempts. Request a new code.', 400);

      if (String(row.code) !== String(otp)) {
        await admin.from('otp_codes').update({ attempts: row.attempts + 1 }).eq('id', row.id);
        return err('Invalid code', 400);
      }

      await admin.from('otp_codes').update({ consumed: true }).eq('id', row.id);

      const { user_id, role, full_name, password, photo_url } = row.payload || {};

      const { error: updateErr } = await admin.auth.admin.updateUserById(user_id, {
        password,
        email_confirm: true,
        user_metadata: { role, full_name, avatar_url: photo_url || null },
      });
      if (updateErr) return err(updateErr.message, 400);

      const login_id = await generateLoginId(admin);

      const { error: profileErr } = await admin.from('user_profiles').insert({
        id: user_id,
        email,
        role,
        full_name: full_name || null,
        photo_url: photo_url || null,
        login_id,
      });
      if (profileErr) return err(profileErr.message, 400);

      if (role === 'worker') await admin.from('workers').insert({ user_id });
      else await admin.from('employers').insert({ user_id });

      const supaAnon = (await import('@supabase/supabase-js')).createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );
      const { data: signed, error: signErr } = await supaAnon.auth.signInWithPassword({ email, password });
      if (signErr) return err(signErr.message, 400);

      await sendEmail({
        to: email,
        subject: 'Welcome to Work2Wish',
        html: `<h2>Welcome, ${full_name || 'there'}!</h2><p>Your ${role} account is ready. Your Login ID is <b>${login_id}</b>.</p>`,
      });

      return json({
        user: signed.user,
        session: signed.session,
        role,
        login_id,
        profile: { id: user_id, email, role, full_name, photo_url, login_id },
      });
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
      if (profile?.blocked) return err('Your account has been blocked by admin.', 403);
      await logActivity(admin, signed.user.id, 'login', { role: profile?.role || 'worker', email: profile?.email || resolvedEmail }, signed.user.id);
      return json({ user: signed.user, session: signed.session, role: profile?.role || 'worker', login_id: profile?.login_id, profile });
    }

    // ---------- Auth required for everything below ----------
    const me = await getUserFromRequest(request);
    if (!me) return err('Unauthorized', 401);


    async function requireAdmin() {
      const { data: profile } = await admin.from('user_profiles').select('role,blocked').eq('id', me.id).maybeSingle();
      if (!profile || profile.role !== 'admin') return { error: 'Admin access required', status: 403 };
      if (profile.blocked) return { error: 'Admin account is blocked', status: 403 };
      return { ok: true };
    }

    async function deleteUserEverywhere(userId) {
      await admin.from('messages').delete().or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
      await admin.from('notifications').delete().eq('user_id', userId);
      await admin.from('applications').delete().eq('worker_id', userId);
      const { data: ownedJobs } = await admin.from('jobs').select('id').eq('employer_id', userId);
      const ownedJobIds = (ownedJobs || []).map(j => j.id);
      if (ownedJobIds.length) await admin.from('applications').delete().in('job_id', ownedJobIds);
      await admin.from('jobs').delete().eq('employer_id', userId);
      await admin.from('workers').delete().eq('user_id', userId);
      await admin.from('employers').delete().eq('user_id', userId);
      await admin.from('user_profiles').delete().eq('id', userId);
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw new Error(error.message);
    }


    async function getUserAdminDetail(userId) {
      const { data: profile } = await admin.from('user_profiles').select('*').eq('id', userId).maybeSingle();
      if (!profile) return null;
      let extra = null;
      if (profile.role === 'worker') {
        const { data } = await admin.from('workers').select('*').eq('user_id', userId).maybeSingle();
        extra = data;
      } else if (profile.role === 'employer') {
        const { data } = await admin.from('employers').select('*').eq('user_id', userId).maybeSingle();
        extra = data;
      }
      return { ...profile, ...(extra || {}) };
    }

    if (path === 'admin/users' && method === 'GET') {
      const check = await requireAdmin();
      if (check.error) return err(check.error, check.status);

      const url = new URL(request.url);
      const roleFilter = url.searchParams.get('role') || '';
      const statusFilter = url.searchParams.get('status') || '';
      const search = (url.searchParams.get('q') || '').toLowerCase();

      const { data: profiles, error } = await admin.from('user_profiles')
        .select('id,email,full_name,phone,photo_url,role,login_id,blocked,created_at,updated_at')
        .order('created_at', { ascending: false });
      if (error) return err(error.message, 400);

      let users = [];
      for (const p of profiles || []) {
        const detail = await getUserAdminDetail(p.id);
        if (!detail) continue;
        users.push(detail);
      }

      if (roleFilter && roleFilter !== 'all') users = users.filter(u => u.role === roleFilter);
      if (statusFilter && statusFilter !== 'all') {
        if (statusFilter === 'blocked') users = users.filter(u => u.blocked);
        else if (statusFilter === 'verified') users = users.filter(u => u.verified);
        else if (statusFilter === 'pending') users = users.filter(u => u.verification_status === 'submitted' || u.verification_status === 'pending');
        else if (statusFilter === 'unverified') users = users.filter(u => !u.verified);
      }
      if (search) {
        users = users.filter(u => `${u.email || ''} ${u.full_name || ''} ${u.company_name || ''} ${u.role || ''} ${u.login_id || ''} ${u.location_text || ''} ${u.address || ''} ${u.company_address || ''} ${u.aadhaar_number || ''} ${u.pan_number || ''} ${u.gst_number || ''} ${u.verification_status || ''}`.toLowerCase().includes(search));
      }

      // Show newly submitted verification requests at the top of the admin table.
      users.sort((a, b) => {
        const aPending = ['submitted', 'pending'].includes(a.verification_status || '');
        const bPending = ['submitted', 'pending'].includes(b.verification_status || '');
        if (aPending !== bPending) return aPending ? -1 : 1;
        return new Date(b.verification_submitted_at || b.updated_at || b.created_at || 0) - new Date(a.verification_submitted_at || a.updated_at || a.created_at || 0);
      });

      return json({ users });
    }


    if (path.match(/^admin\/users\/[^/]+$/) && method === 'GET') {
      const check = await requireAdmin();
      if (check.error) return err(check.error, check.status);
      const userId = path.split('/')[2];
      const user = await getUserAdminDetail(userId);
      if (!user) return err('User not found', 404);
      let jobs = [], applications = [], activity = [];
      try {
        if (user.role === 'employer') {
          const { data } = await admin.from('jobs').select('*, applications(id,status,worker_id,created_at)').eq('employer_id', userId).order('created_at', { ascending: false }).limit(25);
          jobs = data || [];
        }
        if (user.role === 'worker') {
          const { data } = await admin.from('applications').select('*, jobs(title,category,location_text,daily_pay,start_date,employer_id)').eq('worker_id', userId).order('created_at', { ascending: false }).limit(25);
          applications = data || [];
        }
      } catch (e) { console.warn('admin detail enrich skipped', e?.message); }
      try {
        const { data } = await admin.from('activity_logs').select('*').or(`user_id.eq.${userId},actor_id.eq.${userId}`).order('created_at', { ascending: false }).limit(40);
        activity = data || [];
      } catch (e) { activity = []; }
      return json({ user: { ...user, jobs, applications, activity } });
    }

    if (path.match(/^admin\/users\/[^/]+\/verify$/) && method === 'PATCH') {
      const check = await requireAdmin();
      if (check.error) return err(check.error, check.status);
      const userId = path.split('/')[2];
      const body = await request.json().catch(() => ({}));
      const verified = body.verified !== false;
      const notes = body.notes || null;
      const badges = body.badges || {};
      const { data: profile } = await admin.from('user_profiles').select('role').eq('id', userId).maybeSingle();
      if (!profile) return err('User not found', 404);
      if (!['worker', 'employer'].includes(profile.role)) return err('Only worker/employer accounts can be verified', 400);
      const table = profile.role === 'worker' ? 'workers' : 'employers';
      const updatePayload = {
        verified,
        verification_status: verified ? 'verified' : 'rejected',
        verification_notes: notes,
        verified_at: verified ? new Date().toISOString() : null,
      };
      if (profile.role === 'worker') {
        updatePayload.badge_verified_worker = !!badges.verified_worker;
        updatePayload.badge_skilled_worker = !!badges.skilled_worker;
        updatePayload.badge_experienced = !!badges.experienced;
        updatePayload.badge_immediate_joiner = !!badges.immediate_joiner;
        if ('mobile_verified' in body) updatePayload.mobile_verified = !!body.mobile_verified;
        if ('selfie_verified' in body) updatePayload.selfie_verified = !!body.selfie_verified;
      }
      let { error } = await admin.from(table).update(updatePayload).eq('user_id', userId);
      if (error && String(error.message || '').toLowerCase().includes('column')) {
        delete updatePayload.badge_verified_worker;
        delete updatePayload.badge_skilled_worker;
        delete updatePayload.badge_experienced;
        delete updatePayload.badge_immediate_joiner;
        delete updatePayload.mobile_verified;
        delete updatePayload.selfie_verified;
        ({ error } = await admin.from(table).update(updatePayload).eq('user_id', userId));
      }
      if (error) return err(error.message, 400);
      await notify(admin, userId, verified ? 'Account verified' : 'Verification update', verified ? 'Your Work2Wish account is now verified.' : 'Your verification was not approved. Please update your documents.', 'verification', userId);
      await logActivity(admin, userId, verified ? 'admin_verified_account' : 'admin_rejected_verification', { verified, notes }, me.id);
      await logActivity(admin, me.id, verified ? 'verified_user' : 'rejected_user', { user_id: userId, role: profile.role }, me.id);
      return json({ ok: true, verified });
    }

    if (path.match(/^admin\/users\/[^/]+\/section-verify$/) && method === 'PATCH') {
      const check = await requireAdmin();
      if (check.error) return err(check.error, check.status);
      const userId = path.split('/')[2];
      const body = await request.json().catch(() => ({}));
      const section = body.section || 'profile';
      const allowed = ['profile', 'bank', 'verification', 'documents', 'identity', 'location', 'admin_message'];
      if (!allowed.includes(section)) return err('Invalid section', 400);
      const { data: profile } = await admin.from('user_profiles').select('role,email,full_name').eq('id', userId).maybeSingle();
      if (!profile) return err('User not found', 404);
      if (profile.role === 'admin') return err('Admin profile cannot be verified here', 400);
      const label = section === 'bank' ? 'Bank Details' : (section === 'verification' || section === 'documents') ? (profile.role === 'worker' ? 'Worker Verification' : 'Employer Verification') : section === 'identity' ? 'Identity Checks' : section === 'location' ? 'Location Details' : section === 'admin_message' ? 'Admin Message' : 'Profile';
      if (!body.messageOnly) {
        // Keep the section approval persisted on the profile row too.
        // This prevents a re-submitted section from staying visually Pending after admin approval
        // when activity log rows share close timestamps or the client reloads before logs settle.
        const table = profile.role === 'worker' ? 'workers' : 'employers';
        const sectionKey = section === 'verification' ? 'documents' : section;
        await admin.from(table).update({
          verification_status: 'verified',
          verification_section: sectionKey,
          verification_notes: null,
          verified_at: new Date().toISOString(),
        }).eq('user_id', userId);
        await notify(admin, userId, `${label} verified`, `Admin verified your ${label.toLowerCase()} section.`, 'verification_section', userId);
      }
      await logActivity(admin, userId, body.messageOnly ? 'admin_sent_message' : 'admin_verified_section', { section, label, message: body.message || null }, me.id);
      await logActivity(admin, me.id, body.messageOnly ? 'sent_profile_message' : 'verified_profile_section', { user_id: userId, section, role: profile.role }, me.id);
      return json({ ok: true, section });
    }

    if (path.match(/^admin\/users\/[^/]+\/messages$/) && method === 'GET') {
      const check = await requireAdmin();
      if (check.error) return err(check.error, check.status);
      const userId = path.split('/')[2];
      const { data, error } = await admin.from('messages')
        .select('*')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) return err(error.message, 400);
      return json({ messages: data || [] });
    }

    if (path.match(/^admin\/users\/[^/]+\/block$/) && method === 'PATCH') {
      const check = await requireAdmin();
      if (check.error) return err(check.error, check.status);
      const userId = path.split('/')[2];
      const body = await request.json().catch(() => ({}));
      const blocked = !!body.blocked;
      if (userId === me.id) return err('You cannot block your own admin account', 400);
      const { data: target } = await admin.from('user_profiles').select('role').eq('id', userId).maybeSingle();
      if (!target) return err('User not found', 404);
      if (target.role === 'admin') return err('Cannot block another admin from this panel', 403);
      const { error } = await admin.from('user_profiles').update({ blocked, updated_at: new Date().toISOString() }).eq('id', userId);
      if (error) return err(error.message, 400);
      await notify(admin, userId, blocked ? 'Account blocked' : 'Account unblocked', blocked ? 'Admin blocked your account.' : 'Admin unblocked your account.', 'admin_action', userId);
      await logActivity(admin, userId, blocked ? 'admin_blocked_account' : 'admin_unblocked_account', {}, me.id);
      await logActivity(admin, me.id, blocked ? 'blocked_user' : 'unblocked_user', { user_id: userId }, me.id);
      return json({ ok: true, blocked });
    }

    if (path.match(/^admin\/users\/[^/]+$/) && method === 'DELETE') {
      const check = await requireAdmin();
      if (check.error) return err(check.error, check.status);
      const userId = path.split('/')[2];
      if (userId === me.id) return err('You cannot delete your own admin account', 400);
      const { data: target } = await admin.from('user_profiles').select('role').eq('id', userId).maybeSingle();
      if (!target) return err('User not found', 404);
      if (target.role === 'admin') return err('Cannot delete another admin from this panel', 403);
      await logActivity(admin, me.id, 'deleted_user', { user_id: userId, role: target.role }, me.id);
      try { await deleteUserEverywhere(userId); } catch (e) { return err(e.message, 400); }
      return json({ ok: true });
    }

    // ---------- ME / profile ----------
    if (path === 'me' && method === 'GET') {
      const { data: profile } = await admin.from('user_profiles').select('*').eq('id', me.id).maybeSingle();
      if (profile?.blocked) return err('Your account has been blocked by admin.', 403);
      let extra = null;
      if (profile?.role === 'worker') {
        const { data } = await admin.from('workers').select('*').eq('user_id', me.id).maybeSingle();
        extra = data;
      } else if (profile?.role === 'employer') {
        const { data } = await admin.from('employers').select('*').eq('user_id', me.id).maybeSingle();
        extra = data;
      }

      // Section-level verification state for profile / bank / documents.
      // Latest admin verification wins; if user submits after verification, it becomes pending again.
      let section_statuses = {};
      try {
        const { data: rows } = await admin
          .from('activity_logs')
          .select('id,action,details,created_at')
          .eq('user_id', me.id)
          .in('action', ['admin_verified_section', 'submitted_section_verification', 'submitted_verification'])
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(100);
        for (const row of rows || []) {
          const details = typeof row.details === 'string' ? JSON.parse(row.details || '{}') : (row.details || {});
          const rawSection = details.section || (row.action === 'submitted_verification' ? 'documents' : 'profile');
          // Keep old admin key `verification` and user-facing card key `documents` in sync.
          // Admin verifies Worker/Employer Verification, but the profile page card reads Documents.
          const section = rawSection === 'verification' ? 'documents' : rawSection;
          if (!section_statuses[section]) {
            section_statuses[section] = row.action === 'admin_verified_section' ? 'verified' : 'pending';
          }
        }
        const persistedSection = extra?.verification_section === 'verification' ? 'documents' : extra?.verification_section;
        if (extra?.verification_status === 'verified' && persistedSection) {
          section_statuses[persistedSection] = 'verified';
        }
      } catch (e) {
        section_statuses = {};
      }
      return json({ profile, extra, section_statuses });
    }

    if (path === 'me/activity' && method === 'GET') {
      let activity = [];
      try {
        const { data } = await admin.from('activity_logs').select('*').or(`user_id.eq.${me.id},actor_id.eq.${me.id}`).order('created_at', { ascending: false }).limit(100);
        activity = data || [];
      } catch (e) {
        activity = [];
      }
      return json({ activity });
    }

    if (path === 'me/account' && method === 'DELETE') {
      const userId = me.id;

      await admin.from('messages').delete().or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
      await admin.from('notifications').delete().eq('user_id', userId);
      await admin.from('applications').delete().eq('worker_id', userId);
      await admin.from('jobs').delete().eq('employer_id', userId);
      await admin.from('workers').delete().eq('user_id', userId);
      await admin.from('employers').delete().eq('user_id', userId);
      await admin.from('user_profiles').delete().eq('id', userId);

      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) return err(error.message, 400);

      return json({ ok: true });
    }

    if (path === 'me/profile' && method === 'PATCH') {
      const body = await request.json();
      const profileFields = ['full_name', 'phone', 'photo_url', 'language'];
      const profileUpdate = {};
      for (const k of profileFields) if (k in body) profileUpdate[k] = body[k];
      if (Object.keys(profileUpdate).length) {
        profileUpdate.updated_at = new Date().toISOString();
        await admin.from('user_profiles').update(profileUpdate).eq('id', me.id);
      }
      const { data: profile } = await admin.from('user_profiles').select('*').eq('id', me.id).maybeSingle();

      const role = profile?.role;
      let updatedExtra = null;

      if (role === 'worker') {
        const wf = ['age', 'gender', 'skills', 'experience_years', 'experience_level', 'expected_daily_wage', 'languages_known',
                    'bank_account', 'account_holder_name', 'bank_name', 'ifsc_code', 'branch_name', 'upi_id', 'bank_qr_url', 'selfie_url', 'selfie_front_url', 'selfie_left_url', 'selfie_right_url', 'selfie_verified', 'selfie_verified_at', 'certificate_url', 'previous_employer_reference',
                    'location_text', 'latitude', 'longitude', 'place_id', 'place_name', 'bio', 'available', 'address',
                    'aadhaar_number', 'pan_number', 'aadhaar_front_url', 'aadhaar_back_url', 'pan_image_url', 'pan_back_url',
                    'verification_status', 'verification_notes', 'badge_immediate_joiner'];
        const wu = {}; for (const k of wf) if (k in body) wu[k] = body[k];
        if ('available' in body) wu.badge_immediate_joiner = !!body.available;

        if (body.verification_status === 'submitted' || body.verification_status === 'pending') {
          wu.verified = false;
          wu.verification_status = 'pending';
          wu.verification_notes = null;
          wu.verification_submitted_at = new Date().toISOString();
        }

        if (Object.keys(wu).length) {
          const { data: existingWorker } = await admin.from('workers').select('user_id').eq('user_id', me.id).maybeSingle();
          let result;
          if (existingWorker) {
            result = await admin.from('workers').update(wu).eq('user_id', me.id).select().maybeSingle();
          } else {
            result = await admin.from('workers').insert({ user_id: me.id, ...wu }).select().maybeSingle();
          }
          if (result.error && String(result.error.message || '').toLowerCase().includes('column')) {
            const safeKeys = ['age','skills','experience_years','expected_daily_wage','location_text','latitude','longitude','place_id','place_name','bio','available','address','aadhaar_number','pan_number','aadhaar_front_url','aadhaar_back_url','pan_image_url','pan_back_url','certificate_url','account_holder_name','bank_name','bank_account','ifsc_code','branch_name','upi_id','bank_qr_url','selfie_front_url','selfie_left_url','selfie_right_url','verification_status','verification_notes','verified','verification_submitted_at','mobile_verified','selfie_verified','badge_verified_worker','badge_skilled_worker','badge_experienced','badge_immediate_joiner'];
            const safe = {}; for (const k of safeKeys) if (k in wu) safe[k] = wu[k];
            result = existingWorker
              ? await admin.from('workers').update(safe).eq('user_id', me.id).select().maybeSingle()
              : await admin.from('workers').insert({ user_id: me.id, ...safe }).select().maybeSingle();
          }
          if (result.error) return err(result.error.message, 400);
          updatedExtra = result.data;
        }
      } else if (role === 'employer') {
        const ef = ['company_name', 'company_logo', 'industry', 'company_size', 'hr_contact', 'official_email', 'location_text',
                    'latitude', 'longitude', 'place_id', 'place_name', 'description', 'company_address', 'gst_number',
                    'aadhaar_number', 'pan_number', 'aadhaar_front_url', 'aadhaar_back_url', 'pan_image_url', 'pan_back_url', 'gst_certificate_url',
                    'account_holder_name', 'bank_name', 'bank_account', 'ifsc_code', 'branch_name', 'upi_id', 'bank_qr_url',
                    'verification_status', 'verification_notes'];
        const eu = {}; for (const k of ef) if (k in body) eu[k] = body[k];

        if (body.verification_status === 'submitted' || body.verification_status === 'pending') {
          eu.verified = false;
          eu.verification_status = 'pending';
          eu.verification_notes = null;
          eu.verification_submitted_at = new Date().toISOString();
        }

        if (Object.keys(eu).length) {
          const { data: existingEmployer } = await admin.from('employers').select('user_id').eq('user_id', me.id).maybeSingle();
          let result;
          if (existingEmployer) {
            result = await admin.from('employers').update(eu).eq('user_id', me.id).select().maybeSingle();
          } else {
            result = await admin.from('employers').insert({ user_id: me.id, ...eu }).select().maybeSingle();
          }
          if (result.error && String(result.error.message || '').toLowerCase().includes('column')) {
            const safeKeys = ['company_name','company_logo','industry','company_size','hr_contact','official_email','location_text','latitude','longitude','place_id','place_name','description','company_address','gst_number','aadhaar_number','pan_number','aadhaar_front_url','aadhaar_back_url','pan_image_url','pan_back_url','gst_certificate_url','account_holder_name','bank_name','bank_account','ifsc_code','branch_name','upi_id','bank_qr_url','verification_status','verification_notes','verified','verification_submitted_at','mobile_verified','selfie_verified','badge_verified_worker','badge_skilled_worker','badge_experienced','badge_immediate_joiner'];
            const safe = {}; for (const k of safeKeys) if (k in eu) safe[k] = eu[k];
            result = existingEmployer
              ? await admin.from('employers').update(safe).eq('user_id', me.id).select().maybeSingle()
              : await admin.from('employers').insert({ user_id: me.id, ...safe }).select().maybeSingle();
          }
          if (result.error) return err(result.error.message, 400);
          updatedExtra = result.data;
        }
      }

      if (body.verification_status === 'submitted' || body.verification_status === 'pending') {
        const { data: admins } = await admin.from('user_profiles').select('id').eq('role', 'admin').eq('blocked', false);
        const displayName = profile?.full_name || profile?.company_name || profile?.email || 'A user';
        const verificationSection = body.verification_section || 'documents';
        const sectionLabel = verificationSection === 'bank' ? 'Bank details' : verificationSection === 'profile' ? 'Profile details' : 'Documents';
        const changedFields = Object.keys(body).filter(k => !['verification_status','verification_notes','verification_section'].includes(k));
        const isSkillOnly = changedFields.length === 1 && changedFields[0] === 'certificate_url';
        const title = isSkillOnly ? 'Skill certificate needs review' : `${sectionLabel} needs review`;
        const bodyText = isSkillOnly
          ? `${displayName} added a skill certificate. Review it and mark the account verified again.`
          : `${displayName} (${profile?.role || 'user'}) submitted ${sectionLabel.toLowerCase()} for admin verification. Updated: ${changedFields.join(', ') || sectionLabel}.`;
        for (const a of admins || []) {
          await notify(admin, a.id, title, bodyText, 'verification', me.id);
        }
      }

      await logActivity(
        admin,
        me.id,
        (body.verification_status === 'submitted' || body.verification_status === 'pending') ? 'submitted_section_verification' : 'updated_profile',
        { section: body.verification_section || 'profile', fields: Object.keys(body).filter(k => !['password','verification_section'].includes(k)) },
        me.id
      );
      return json({ ok: true, profile, extra: updatedExtra });
    }


    // ---------- Public profile summary ----------
    if (path.match(/^profiles\/[^/]+$/) && method === 'GET') {
      const profileId = path.split('/')[1];
      const { data: user, error: userError } = await admin.from('user_profiles').select('*').eq('id', profileId).maybeSingle();
      if (userError) return err(userError.message, 400);
      if (!user) return err('Profile not found', 404);
      let extra = null, completedWorks = 0, feedbacks = [], postedJobs = [], activeHires = [];
      if (user.role === 'worker') {
        const { data: worker } = await admin.from('workers').select('*').eq('user_id', profileId).maybeSingle();
        extra = worker || {};
        const { count } = await admin.from('applications').select('id', { count: 'exact', head: true }).eq('worker_id', profileId).eq('status', 'completed');
        completedWorks = count || 0;
        const { data: wf } = await admin.from('worker_feedbacks').select('rating,feedback_text,created_at,company_id').eq('worker_id', profileId).order('created_at', { ascending: false }).limit(10);
        feedbacks = wf || [];
        const { data: ah } = await admin.from('applications').select('id,status,applied_at,started_at,completed_at,jobs(title,location_text,daily_pay,start_date,duration_days,employer_id,employers(company_name,company_logo))').eq('worker_id', profileId).in('status', ['accepted','ongoing','completed']).order('applied_at', { ascending: false }).limit(8);
        activeHires = ah || [];
      } else if (user.role === 'employer') {
        const { data: employer } = await admin.from('employers').select('*').eq('user_id', profileId).maybeSingle();
        extra = employer || {};
        const { data: jobs } = await admin.from('jobs').select('id,title,category,location_text,daily_pay,status,created_at,duration_days,workers_needed').eq('employer_id', profileId).order('created_at', { ascending: false }).limit(10);
        postedJobs = jobs || [];
        const { data: cf } = await admin.from('company_feedbacks').select('rating,feedback_text,created_at,worker_id').eq('company_id', profileId).order('created_at', { ascending: false }).limit(10);
        feedbacks = cf || [];
        const { count } = await admin.from('applications').select('id,jobs!inner(employer_id)', { count: 'exact', head: true }).eq('jobs.employer_id', profileId).eq('status', 'completed');
        completedWorks = count || 0;
      }
      return json({ profile: { ...user, ...extra, role: user.role, id: user.id }, stats: { completedWorks, feedbackCount: feedbacks.length, postedJobs: postedJobs.length }, feedbacks, postedJobs, activeHires });
    }

    // Worker confirms an employer-selected application before job moves forward.

    if (path.match(/^applications\/[^/]+$/) && method === 'GET') {
      const appId = path.split('/')[1];
      const { data: appRow, error } = await admin.from('applications')
        .select('*, jobs(id,title,employer_id,location_text,duration_days,daily_pay,status)')
        .eq('id', appId)
        .maybeSingle();
      if (error || !appRow) return err('Application not found', 404);
      const isEmployer = appRow.jobs?.employer_id === me.id;
      const isWorker = appRow.worker_id === me.id;
      const { data: profile } = await admin.from('user_profiles').select('role').eq('id', me.id).maybeSingle();
      if (!isEmployer && !isWorker && profile?.role !== 'admin') return err('Not allowed', 403);
      return json({ application: appRow });
    }

    if (path.match(/^applications\/[^/]+\/worker-confirm$/) && method === 'POST') {
      const appId = path.split('/')[1];

      // Employee/worker accepts the employer invitation.
      // Do not depend on role text here because some project copies store the role as
      // "employee" while older code used "worker". Ownership of the application is
      // the real permission check.
      const { data: appRow } = await admin.from('applications')
        .select('*, jobs!inner(employer_id,title,start_date,duration_days)')
        .eq('id', appId).eq('worker_id', me.id).maybeSingle();
      if (!appRow) return err('Application not found for this employee', 404);
      if (!['accepted', 'ongoing'].includes(appRow.status)) return err('Only accepted jobs can be confirmed', 400);

      const { data: workerProfile } = await admin.from('user_profiles')
        .select('full_name,email')
        .eq('id', me.id)
        .maybeSingle();

      const startedAt = appRow.started_at || new Date().toISOString();
      const updateData = { status: 'ongoing', started_at: startedAt };
      let { data, error } = await admin.from('applications')
        .update({ ...updateData, worker_confirmed_at: new Date().toISOString() })
        .eq('id', appId)
        .select()
        .single();
      if (error && String(error.message || '').toLowerCase().includes('column')) {
        ({ data, error } = await admin.from('applications').update(updateData).eq('id', appId).select().single());
      }
      if (error) return err(error.message, 400);

      await notify(admin, appRow.jobs.employer_id, 'Worker accepted the hire', `${workerProfile?.full_name || 'Worker'} accepted "${appRow.jobs.title}". The job moved to ongoing. You can now mark attendance.`, 'application', appId);
      await notify(admin, me.id, 'Job moved to ongoing', `You accepted "${appRow.jobs.title}". Attendance tracking is now enabled.`, 'application', appId);
      await logActivity(admin, me.id, 'worker_confirmed_hire', { application_id: appId, job_title: appRow.jobs.title }, me.id);
      await logActivity(admin, appRow.jobs.employer_id, 'worker_confirmed_hire', { application_id: appId, worker_id: me.id, job_title: appRow.jobs.title }, me.id);
      return json({ application: data });
    }

    // ---------- Jobs ----------
    if (path === 'jobs' && method === 'GET') {
      const url = new URL(request.url);
      const q = (url.searchParams.get('q') || '').toLowerCase();
      const category = url.searchParams.get('category') || '';
      const minPay = Number(url.searchParams.get('min_pay') || 0);
      let qb = admin.from('jobs')
        .select('*, employers!inner(company_name, company_logo, location_text, verified), applications(id,status)')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(100);
      if (category) qb = qb.eq('category', category);
      const { data, error } = await qb;
      if (error) return err(error.message, 400);
      const now = Date.now();
      const jobs = (data || []).filter(j => {
        const text = `${j.title || ''} ${j.description || ''} ${j.category || ''} ${j.skill_needed || ''} ${j.location_text || ''} ${j.employers?.company_name || ''}`.toLowerCase();
        const exp = j.expires_at ? new Date(j.expires_at).getTime() : (j.post_valid_days && j.created_at ? new Date(j.created_at).getTime() + Number(j.post_valid_days) * 86400000 : null);
        return (!q || text.includes(q)) && (!minPay || Number(j.daily_pay || 0) >= minPay) && (!exp || exp >= now);
      }).slice(0, 50).map(j => {
        const apps = j.applications || [];
        return {
          ...j,
          applications: undefined,
          applicants_count: apps.length,
          pending_count: apps.filter(a => a.status === 'pending').length,
          hired_count: apps.filter(a => ['accepted','ongoing'].includes(a.status)).length,
        };
      });
      return json({ jobs });
    }

    if (path === 'jobs' && method === 'POST') {
      const body = await request.json();
      // ensure employer
      const { data: profile } = await admin.from('user_profiles').select('role').eq('id', me.id).maybeSingle();
      if (profile?.role !== 'employer') return err('Only employers can post jobs', 403);

      const { data: employer } = await admin.from('employers')
        .select('location_text, latitude, longitude')
        .eq('user_id', me.id)
        .maybeSingle();

      const locationText = (body.location_text || '').trim() || employer?.location_text || null;
      const latitude = body.latitude !== undefined && body.latitude !== null && body.latitude !== ''
        ? Number(body.latitude)
        : (employer?.latitude !== undefined && employer?.latitude !== null ? Number(employer.latitude) : null);
      const longitude = body.longitude !== undefined && body.longitude !== null && body.longitude !== ''
        ? Number(body.longitude)
        : (employer?.longitude !== undefined && employer?.longitude !== null ? Number(employer.longitude) : null);

      const basePayload = {
        employer_id: me.id,
        title: body.title,
        category: body.category,
        description: body.description,
        location_text: locationText,
        latitude: Number.isFinite(latitude) ? latitude : null,
        longitude: Number.isFinite(longitude) ? longitude : null,
        daily_pay: Number(body.daily_pay) || 0,
        duration_days: Number(body.duration_days) || 1,
        start_date: body.start_date || null,
        status: 'open',
      };

      // Extra job-form fields. These will be saved if your Supabase jobs table has these columns.
      // If the columns are not added yet, the API retries with the base payload so posting still works.
      const extendedPayload = {
        ...basePayload,
        workers_needed: Number(body.workers_needed) || 1,
        skill_needed: body.skill_needed || null,
        shift_timing: body.shift_timing || null,
        experience: body.experience || null,
        contact_number: body.contact_number || null,
        accommodation_available: body.accommodation_available === true || body.accommodation_available === 'yes',
        food_included: body.food_included === true || body.food_included === 'yes',
        urgent_hiring: !!body.urgent_hiring,
        overtime_available: !!body.overtime_available,
        transportation_provided: !!body.transportation_provided,
        post_valid_days: Number(body.post_valid_days) || 5,
        attendance_radius_meters: Math.max(10, Math.min(Number(body.attendance_radius_meters) || 20, 200)),
        expires_at: (() => { const d = new Date(); d.setDate(d.getDate() + (Number(body.post_valid_days) || 5)); return d.toISOString(); })(),
      };

      let { data, error } = await admin.from('jobs').insert(extendedPayload).select().single();
      if (error && String(error.message || '').toLowerCase().includes('column')) {
        ({ data, error } = await admin.from('jobs').insert(basePayload).select().single());
      }
      if (error) return err(error.message, 400);
      await logActivity(admin, me.id, 'posted_job', { job_id: data.id, title: data.title, daily_pay: data.daily_pay }, me.id);
      const { data: adminsForJob } = await admin.from('user_profiles').select('id').eq('role', 'admin').eq('blocked', false);
      for (const a of adminsForJob || []) await notify(admin, a.id, 'New job posted', `${body.title} was posted by an employer.`, 'job_post', data.id);
      return json({ job: data });
    }

    if (path.match(/^jobs\/[^/]+$/) && method === 'PATCH') {
      const jobId = path.split('/')[1];
      const body = await request.json();
      const { data: current } = await admin.from('jobs').select('*').eq('id', jobId).maybeSingle();
      if (!current) return err('Job not found', 404);
      if (current.employer_id !== me.id) return err('Forbidden', 403);
      const days = Number(body.post_valid_days || current.post_valid_days || 5);
      const expires = new Date(); expires.setDate(expires.getDate() + days);
      const updatePayload = {
        title: body.title,
        category: body.category,
        description: body.description,
        location_text: body.location_text || current.location_text,
        latitude: body.latitude !== '' && body.latitude !== undefined ? Number(body.latitude) : current.latitude,
        longitude: body.longitude !== '' && body.longitude !== undefined ? Number(body.longitude) : current.longitude,
        daily_pay: Number(body.daily_pay) || current.daily_pay,
        duration_days: Number(body.duration_days) || current.duration_days,
        start_date: body.start_date || current.start_date,
        workers_needed: Number(body.workers_needed) || current.workers_needed || 1,
        skill_needed: body.skill_needed || null,
        shift_timing: body.shift_timing || null,
        experience: body.experience || null,
        contact_number: body.contact_number || null,
        accommodation_available: body.accommodation_available === true || body.accommodation_available === 'yes',
        food_included: body.food_included === true || body.food_included === 'yes',
        urgent_hiring: !!body.urgent_hiring,
        overtime_available: !!body.overtime_available,
        transportation_provided: !!body.transportation_provided,
        post_valid_days: days,
        attendance_radius_meters: Math.max(10, Math.min(Number(body.attendance_radius_meters || current.attendance_radius_meters) || 20, 200)),
        expires_at: expires.toISOString(),
        status: body.status || current.status || 'open',
      };
      let { data, error } = await admin.from('jobs').update(updatePayload).eq('id', jobId).select().single();
      if (error && String(error.message || '').toLowerCase().includes('column')) {
        const basic = { title: updatePayload.title, category: updatePayload.category, description: updatePayload.description, location_text: updatePayload.location_text, daily_pay: updatePayload.daily_pay, duration_days: updatePayload.duration_days, start_date: updatePayload.start_date, status: updatePayload.status };
        ({ data, error } = await admin.from('jobs').update(basic).eq('id', jobId).select().single());
      }
      if (error) return err(error.message, 400);
      await logActivity(admin, me.id, 'updated_job_post', { job_id: jobId, title: data.title, visible_for_days: days }, me.id);
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
      const enriched = (data || []).map(j => {
        const apps = j.applications || [];
        const hiredApps = apps.filter(a => ['accepted', 'ongoing'].includes(a.status));
        return {
          ...j,
          applicants_count: apps.length,
          pending_count: apps.filter(a => a.status === 'pending').length,
          hired_count: hiredApps.length,
          ongoing_count: apps.filter(a => a.status === 'ongoing').length,
          invitation_count: apps.filter(a => a.status === 'accepted').length,
        };
      });
      return json({ jobs: enriched });
    }

    if (path.match(/^employer\/jobs\/[^/]+$/) && method === 'DELETE') {
      const jobId = path.split('/')[2];
      const { data: jobRow } = await admin.from('jobs')
        .select('id,title,employer_id')
        .eq('id', jobId)
        .maybeSingle();
      if (!jobRow) return err('Job not found', 404);
      if (jobRow.employer_id !== me.id && me.role !== 'admin') return err('Forbidden', 403);

      const { data: appRows } = await admin.from('applications').select('id').eq('job_id', jobId);
      const appIds = (appRows || []).map(a => a.id);
      if (appIds.length) await admin.from('attendance_records').delete().in('application_id', appIds);
      await admin.from('applications').delete().eq('job_id', jobId);
      const { error } = await admin.from('jobs').delete().eq('id', jobId);
      if (error) return err(error.message, 400);

      await logActivity(admin, me.id, 'deleted_job_post', { job_id: jobId, job_title: jobRow.title }, me.id);
      return json({ ok: true });
    }

    if (path === 'employer/attendance' && method === 'GET') {
      const { data, error } = await admin.from('applications')
        .select('id,status,applied_at,accepted_at,started_at,completed_at,worker_id,workers!inner(skills,experience_years,expected_daily_wage,user_profiles!workers_user_id_fkey(full_name,email,phone,photo_url)),jobs!inner(title,location_text,start_date,duration_days,daily_pay,employer_id)')
        .eq('jobs.employer_id', me.id)
        .in('status', ['accepted', 'ongoing', 'completed'])
        .order('applied_at', { ascending: false });
      if (error) return err(error.message, 400);

      const appIds = (data || []).map((app) => app.id);
      const attendanceByApp = {};
      if (appIds.length) {
        const { data: attendanceRows, error: attendanceError } = await admin.from('attendance_records')
          .select('*')
          .in('application_id', appIds)
          .order('attendance_date', { ascending: true });
        if (attendanceError) return err(attendanceError.message, 400);
        for (const row of attendanceRows || []) {
          if (!attendanceByApp[row.application_id]) attendanceByApp[row.application_id] = [];
          attendanceByApp[row.application_id].push(row);
        }
      }

      const todayKey = new Date().toISOString().slice(0, 10);
      const items = (data || []).map((app) => {
        const startValue = app.started_at || app.accepted_at || app.jobs?.start_date || app.applied_at || new Date().toISOString();
        const start = new Date(startValue);
        const duration = Math.max(1, Math.min(Number(app.jobs?.duration_days || 1), 60));
        const existing = attendanceByApp[app.id] || [];
        const existingByDate = new Map(existing.map((row) => [String(row.attendance_date).slice(0, 10), row]));
        const attendance_days = [];

        for (let i = 0; i < duration; i++) {
          const dayDate = new Date(start);
          dayDate.setDate(dayDate.getDate() + i);
          const dateKey = dayDate.toISOString().slice(0, 10);
          const row = existingByDate.get(dateKey);
          let status = row?.status || 'unmarked';
          if (!row && dateKey > todayKey) status = 'upcoming';
          if (!row && dateKey === todayKey && app.status === 'ongoing') status = 'today';
          attendance_days.push({
            day: i + 1,
            date: dateKey,
            status,
            marked: !!row,
            marked_at: row?.marked_at || null,
            marked_by: row?.marked_by || null,
            attendance_id: row?.id || null,
          });
        }

        return {
          application_id: app.id,
          status: app.status,
          start_date: startValue,
          duration_days: duration,
          job_title: app.jobs?.title || '',
          location_text: app.jobs?.location_text || '',
          daily_pay: app.jobs?.daily_pay || 0,
          present_days: existing.filter((row) => row.status === 'present').length,
          absent_days: existing.filter((row) => row.status === 'absent').length,
          total_marked_days: existing.length,
          worker: {
            id: app.worker_id,
            full_name: app.workers?.user_profiles?.full_name || '',
            email: app.workers?.user_profiles?.email || '',
            phone: app.workers?.user_profiles?.phone || '',
            photo_url: app.workers?.user_profiles?.photo_url || '',
            skills: app.workers?.skills || [],
            experience_years: app.workers?.experience_years || 0,
            expected_daily_wage: app.workers?.expected_daily_wage || 0,
          },
          attendance_days,
        };
      });

      return json({ items });
    }

    if (path.match(/^employer\/jobs\/[^/]+\/applicants$/) && method === 'GET') {
      const jobId = path.split('/')[2];
      const { data, error } = await admin.from('applications')
        .select('*, workers!inner(*, user_profiles!workers_user_id_fkey(full_name,email,phone,photo_url)), jobs!inner(start_date,duration_days)')
        .eq('job_id', jobId).order('applied_at', { ascending: false });
      if (error) return err(error.message, 400);

      // IMPORTANT: Do not auto-complete ongoing jobs here.
      // After the employee accepts the invitation, the application must stay in `ongoing`
      // until the employer manually clicks Complete & Pay.

      return json({ applicants: data });
    }


    if (path.match(/^applications\/[^/]+\/attendance$/) && method === 'GET') {
      const appId = path.split('/')[1];
      const { data: appRow } = await admin.from('applications')
        .select('id,worker_id,jobs!inner(employer_id)')
        .eq('id', appId)
        .maybeSingle();
      if (!appRow) return err('Application not found', 404);
      const isEmployer = appRow.jobs?.employer_id === me.id;
      const isWorker = appRow.worker_id === me.id;
      if (!isEmployer && !isWorker && me.role !== 'admin') return err('Forbidden', 403);

      const { data, error } = await admin.from('attendance_records')
        .select('*')
        .eq('application_id', appId)
        .order('attendance_date', { ascending: true });
      if (error) return err(error.message, 400);
      return json({ attendance: data || [] });
    }

    if (path.match(/^applications\/[^/]+\/gps-attendance$/) && method === 'POST') {
      const appId = path.split('/')[1];
      const body = await request.json().catch(() => ({}));
      const date = body.date || new Date().toISOString().slice(0, 10);
      const workerLat = Number(body.latitude);
      const workerLng = Number(body.longitude);
      if (!Number.isFinite(workerLat) || !Number.isFinite(workerLng)) return err('Current GPS is required to mark attendance', 400);

      const { data: appRow } = await admin.from('applications')
        .select('id,status,worker_id,job_id,jobs!inner(employer_id,title,latitude,longitude,attendance_radius_meters)')
        .eq('id', appId)
        .maybeSingle();
      if (!appRow) return err('Application not found', 404);
      if (appRow.worker_id !== me.id && me.role !== 'admin') return err('Only assigned employee can mark GPS attendance', 403);
      if (appRow.status !== 'ongoing') return err('Attendance can be marked only for ongoing jobs', 400);

      const jobLat = Number(appRow.jobs?.latitude);
      const jobLng = Number(appRow.jobs?.longitude);
      if (!Number.isFinite(jobLat) || !Number.isFinite(jobLng)) return err('Employer has not saved job GPS location', 400);

      const allowedMeters = Math.max(10, Math.min(Number(appRow.jobs?.attendance_radius_meters) || 20, 200));
      const distance = distanceMeters(workerLat, workerLng, jobLat, jobLng);
      if (distance === null) return err('Unable to calculate GPS distance', 400);
      if (distance > allowedMeters) return err(`You are ${Math.round(distance)}m away from job location. Attendance allowed within ${allowedMeters}m only.`, 400);

      const payload = {
        application_id: appId,
        job_id: appRow.job_id,
        worker_id: appRow.worker_id,
        employer_id: appRow.jobs.employer_id,
        date,
        attendance_date: date,
        status: 'present',
        marked_by: me.id,
        marked_at: new Date().toISOString(),
        worker_latitude: workerLat,
        worker_longitude: workerLng,
        distance_meters: Math.round(distance),
        verification_method: 'gps',
      };

      let { data, error } = await admin.from('attendance_records')
        .upsert(payload, { onConflict: 'application_id,attendance_date' })
        .select()
        .single();
      if (error && String(error.message || '').toLowerCase().includes('column')) {
        const fallback = { application_id: appId, job_id: appRow.job_id, worker_id: appRow.worker_id, employer_id: appRow.jobs.employer_id, date, attendance_date: date, status: 'present', marked_by: me.id, marked_at: new Date().toISOString() };
        ({ data, error } = await admin.from('attendance_records').upsert(fallback, { onConflict: 'application_id,attendance_date' }).select().single());
      }
      if (error) return err(error.message, 400);

      await notify(admin, appRow.jobs.employer_id, 'Employee marked attendance', `Employee GPS attendance marked present for ${appRow.jobs.title} on ${date}.`, 'attendance_marked', appId);
      await notify(admin, appRow.worker_id, 'Attendance marked', `Your GPS attendance was marked present for ${appRow.jobs.title} on ${date}.`, 'attendance_marked', appId);
      await logActivity(admin, appRow.worker_id, 'gps_attendance_marked', { application_id: appId, date, distance_meters: Math.round(distance), job_title: appRow.jobs.title }, me.id);
      await logActivity(admin, appRow.jobs.employer_id, 'worker_gps_attendance_marked', { application_id: appId, worker_id: appRow.worker_id, date, distance_meters: Math.round(distance), job_title: appRow.jobs.title }, me.id);

      return json({ attendance: data, distance_meters: Math.round(distance), allowed_meters: allowedMeters });
    }

    if (path.match(/^applications\/[^/]+\/attendance$/) && method === 'POST') {
      const appId = path.split('/')[1];
      const body = await request.json().catch(() => ({}));
      const date = body.date || new Date().toISOString().slice(0, 10);
      const status = body.status || 'present';
      if (!['present', 'absent'].includes(status)) return err('Invalid attendance status', 400);

      const { data: appRow } = await admin.from('applications')
        .select('id,status,worker_id,job_id,jobs!inner(employer_id,title)')
        .eq('id', appId)
        .maybeSingle();
      if (!appRow) return err('Application not found', 404);
      if (appRow.jobs?.employer_id !== me.id && me.role !== 'admin') return err('Only employer can mark attendance', 403);
      if (appRow.status !== 'ongoing') return err('Attendance can be marked only after worker accepts and job moves to ongoing', 400);

      const payload = {
        application_id: appId,
        job_id: appRow.job_id,
        worker_id: appRow.worker_id,
        employer_id: appRow.jobs.employer_id,
        // Support both old and new schemas. Some older SQL had a required `date` column.
        date,
        attendance_date: date,
        status,
        marked_by: me.id,
        marked_at: new Date().toISOString(),
      };

      let { data, error } = await admin.from('attendance_records')
        .upsert(payload, { onConflict: 'application_id,attendance_date' })
        .select()
        .single();
      if (error) return err(error.message, 400);

      await notify(admin, appRow.worker_id, 'Attendance updated', `Attendance marked ${status} for ${appRow.jobs.title} on ${date}.`, 'attendance', appId);
      await logActivity(admin, appRow.worker_id, 'attendance_marked', { application_id: appId, date, status, job_title: appRow.jobs.title }, me.id);
      await logActivity(admin, me.id, 'marked_attendance', { application_id: appId, worker_id: appRow.worker_id, date, status, job_title: appRow.jobs.title }, me.id);

      return json({ attendance: data });
    }

    if (path.match(/^applications\/[^/]+$/) && method === 'PATCH') {
      const appId = path.split('/')[1];
      const body = await request.json();
      const status = body.status;
      if (!['accepted','rejected','ongoing','completed'].includes(status))
        return err('Invalid status', 400);
      const { data: appRow } = await admin.from('applications')
        .select('*, jobs!inner(employer_id,title,start_date,duration_days)')
        .eq('id', appId).maybeSingle();
      if (!appRow) return err('Application not found', 404);
      const isEmployerOwner = appRow.jobs.employer_id === me.id;
      const isWorkerOwner = appRow.worker_id === me.id;
      if (!isEmployerOwner && !(isWorkerOwner && status === 'ongoing')) return err('Forbidden', 403);

      // Employer accept means invitation only. Employee/worker must accept before it becomes ongoing.
      const nowIso = new Date().toISOString();
      const updateData = { status };
      if (status === 'accepted') {
        updateData.accepted_at = appRow.accepted_at || nowIso;
      } else if (status === 'ongoing') {
        updateData.accepted_at = appRow.accepted_at || nowIso;
        updateData.started_at = appRow.started_at || nowIso;
        updateData.worker_confirmed_at = appRow.worker_confirmed_at || nowIso;
      } else if (status === 'completed') {
        updateData.completed_at = appRow.completed_at || nowIso;
      }

      let { data, error } = await admin.from('applications').update(updateData).eq('id', appId).select().single();
      if (error && String(error.message || '').toLowerCase().includes('column')) {
        // Older databases may not yet have accepted_at / started_at / worker_confirmed_at / completed_at.
        // Status is the source of truth for tabs, so keep the workflow working.
        ({ data, error } = await admin.from('applications').update({ status }).eq('id', appId).select().single());
      }
      if (error) return err(error.message, 400);
      await notify(admin, appRow.worker_id,
        status === 'accepted' ? 'Job invitation received' : `Application ${status}`,
        status === 'accepted' ? `Your application for "${appRow.jobs.title}" was accepted. Open Applied Jobs and accept the invitation to move it to Ongoing Jobs.` : `Your application for "${appRow.jobs.title}" was ${status}.`,
        'application', appId);
      await logActivity(admin, appRow.worker_id, `application_${status}`, { application_id: appId, job_title: appRow.jobs.title }, me.id);
      await logActivity(admin, me.id, `set_application_${status}`, { application_id: appId, worker_id: appRow.worker_id, job_title: appRow.jobs.title }, me.id);
      const { data: w } = await admin.from('user_profiles').select('email,full_name').eq('id', appRow.worker_id).maybeSingle();
      if (w?.email) sendEmail({
        to: w.email,
        subject: status === 'accepted' ? `Job invitation: ${appRow.jobs.title}` : `Your application was ${status}`,
        html: status === 'accepted'
          ? `<p>Hi ${w.full_name || ''},</p><p>Your application for <b>${appRow.jobs.title}</b> was accepted. Please open Work2Wish Applied Jobs and accept the invitation to start the job.</p>`
          : `<p>Hi ${w.full_name || ''},</p><p>Your application for <b>${appRow.jobs.title}</b> is now <b>${status}</b>.</p>`,
      });
      return json({ application: data });
    }

    if (path.match(/^applications\/[^/]+$/) && method === 'DELETE') {
      const appId = path.split('/')[1];
      const { data: appRow } = await admin.from('applications')
        .select('id,worker_id,job_id,status,jobs!inner(employer_id,title)')
        .eq('id', appId).maybeSingle();
      if (!appRow) return err('Application not found', 404);
      if (appRow.jobs.employer_id !== me.id && me.role !== 'admin') return err('Forbidden', 403);

      await admin.from('attendance_records').delete().eq('application_id', appId);
      const { error } = await admin.from('applications').delete().eq('id', appId);
      if (error) return err(error.message, 400);

      await notify(admin, appRow.worker_id, 'Removed from hired job', `You were removed from "${appRow.jobs.title}" by the employer.`, 'application', appId);
      await logActivity(admin, appRow.worker_id, 'removed_from_hired_job', { application_id: appId, job_title: appRow.jobs.title }, me.id);
      await logActivity(admin, me.id, 'removed_hired_worker', { application_id: appId, worker_id: appRow.worker_id, job_title: appRow.jobs.title }, me.id);
      return json({ ok: true });
    }

    // ---------- Feedback routes ----------
    if (path === 'feedback/company' && method === 'POST') {
      const body = await request.json();
      const { application_id, rating, feedback_text } = body;
      if (!application_id || !rating || rating < 1 || rating > 5) return err('Invalid data', 400);

      const { data: app } = await admin.from('applications')
        .select('*, jobs!inner(employer_id)')
        .eq('id', application_id).eq('worker_id', me.id).maybeSingle();
      if (!app) return err('Application not found or not yours', 404);
      if (app.status !== 'completed') return err('Can only feedback completed jobs', 400);

      const { data, error } = await admin.from('company_feedbacks').insert({
        worker_id: me.id,
        company_id: app.jobs.employer_id,
        application_id,
        rating,
        feedback_text,
      }).select().single();
      if (error) return err(error.message, 400);
      return json({ feedback: data });
    }

    if (path === 'feedback/worker' && method === 'POST') {
      const body = await request.json();
      const { application_id, rating, feedback_text } = body;
      if (!application_id || !rating || rating < 1 || rating > 5) return err('Invalid data', 400);

      const { data: app } = await admin.from('applications')
        .select('*, jobs!inner(employer_id)')
        .eq('id', application_id).eq('jobs.employer_id', me.id).maybeSingle();
      if (!app) return err('Application not found or not yours', 404);
      if (app.status !== 'completed') return err('Can only feedback completed jobs', 400);

      const { data, error } = await admin.from('worker_feedbacks').insert({
        employer_id: me.id,
        worker_id: app.worker_id,
        application_id,
        rating,
        feedback_text,
      }).select().single();
      if (error) return err(error.message, 400);

      // Update worker average rating
      const { data: ratings } = await admin.from('worker_feedbacks')
        .select('rating').eq('worker_id', app.worker_id);
      const avg = ratings.length > 0 ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length : 0;
      await admin.from('workers').update({ average_rating: avg }).eq('user_id', app.worker_id);

      return json({ feedback: data });
    }

    if (path === 'feedback/employer' && method === 'POST') {
      const body = await request.json();
      const { application_id, rating, feedback_text } = body;
      if (!application_id || !rating || rating < 1 || rating > 5) return err('Invalid data', 400);

      const { data: app } = await admin.from('applications')
        .select('*, jobs!inner(employer_id)')
        .eq('id', application_id).eq('jobs.employer_id', me.id).maybeSingle();
      if (!app) return err('Application not found or not yours', 404);
      if (app.status !== 'completed') return err('Can only feedback completed jobs', 400);

      const { data, error } = await admin.from('employer_feedbacks').insert({
        employer_id: me.id,
        worker_id: app.worker_id,
        application_id,
        rating,
        feedback_text,
      }).select().single();
      if (error) return err(error.message, 400);
      return json({ feedback: data });
    }

    // ---------- Worker routes ----------
    if (path === 'worker/applications' && method === 'GET') {
      const { data, error } = await admin.from('applications')
        .select('*, jobs!inner(*, employers!inner(company_name,company_logo,location_text))')
        .eq('worker_id', me.id).order('applied_at', { ascending: false });
      if (error) return err(error.message, 400);

      // IMPORTANT: Do not auto-complete ongoing jobs here.
      // After the employee accepts the invitation, the application must stay in `ongoing`
      // until the employer manually clicks Complete & Pay.

      try {
        const ids = (data || []).map((a) => a.id);
        if (ids.length) {
          const { data: attendanceRows } = await admin.from('attendance_records')
            .select('*')
            .in('application_id', ids)
            .order('attendance_date', { ascending: true });
          const byApp = {};
          for (const row of attendanceRows || []) {
            if (!byApp[row.application_id]) byApp[row.application_id] = [];
            byApp[row.application_id].push(row);
          }
          for (const app of data || []) {
            app.attendance_records = byApp[app.id] || [];
          }
        }
      } catch (e) {
        // Attendance table may not exist until the SQL below is run. Never block jobs loading.
        for (const app of data || []) app.attendance_records = [];
      }

      return json({ applications: data });
    }

    // ---------- Notifications ----------
    if (path === 'notifications' && method === 'GET') {
      const { data } = await admin.from('notifications')
        .select('*').eq('user_id', me.id).order('created_at', { ascending: false }).limit(75);
      return json({ notifications: data || [] });
    }
    if (path === 'notifications/read-all' && method === 'POST') {
      await admin.from('notifications').update({ read: true }).eq('user_id', me.id).eq('read', false);
      return json({ ok: true });
    }
    if (path === 'notifications/clear-read' && method === 'DELETE') {
      await admin.from('notifications').delete().eq('user_id', me.id).eq('read', true);
      return json({ ok: true });
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
    if (path === 'users/search' && method === 'GET') {
      const url = new URL(request.url);
      const q = (url.searchParams.get('q') || '').trim().toLowerCase();
      if (q.length < 2) return json({ users: [] });
      const { data: profiles } = await admin.from('user_profiles')
        .select('id,role,full_name,email,phone,photo_url,verified,blocked')
        .in('role', ['worker','employer'])
        .eq('blocked', false)
        .limit(40);
      const workerIds = (profiles || []).filter(p => p.role === 'worker').map(p => p.id);
      const employerIds = (profiles || []).filter(p => p.role === 'employer').map(p => p.id);
      const { data: workers } = workerIds.length ? await admin.from('workers').select('*').in('user_id', workerIds) : { data: [] };
      const { data: employers } = employerIds.length ? await admin.from('employers').select('*').in('user_id', employerIds) : { data: [] };
      const wm = new Map((workers || []).map(x => [x.user_id, x]));
      const em = new Map((employers || []).map(x => [x.user_id, x]));
      const users = (profiles || []).filter(p => p.id !== me.id).map(p => {
        const extra = p.role === 'employer' ? em.get(p.id) : wm.get(p.id);
        const name = p.role === 'employer' ? (extra?.company_name || p.full_name || p.email) : (p.full_name || p.email);
        return { peer_id: p.id, peer_name: name, peer_photo: p.role === 'employer' ? extra?.company_logo : p.photo_url, peer_role: p.role, email: p.email, location_text: extra?.location_text || extra?.address || extra?.company_address || '' };
      }).filter(u => `${u.peer_name} ${u.email} ${u.location_text} ${u.peer_role}`.toLowerCase().includes(q)).slice(0, 12);
      return json({ users });
    }

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
        let extraPhoto = p.photo_url;
        if (p.role === 'employer') {
          const { data: emp } = await admin.from('employers').select('company_name,company_logo').eq('user_id', p.id).maybeSingle();
          extraName = emp?.company_name;
          extraPhoto = emp?.company_logo || p.photo_url;
        }
        threads.push({
          peer_id: p.id,
          peer_name: extraName || p.full_name || p.email,
          peer_photo: extraPhoto,
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

    if (path.match(/^messages\/[^/]+$/) && method === 'PATCH') {
      const id = path.split('/')[1];
      const body = await request.json();
      const content = (body.content || '').trim();
      if (!content) return err('content required', 400);
      const { data: current } = await admin.from('messages').select('*').eq('id', id).maybeSingle();
      if (!current) return err('Message not found', 404);
      if (current.sender_id !== me.id) return err('You can edit only your messages', 403);
      let { data, error } = await admin.from('messages').update({ content, edited_at: new Date().toISOString() }).eq('id', id).select().single();
      if (error && String(error.message || '').toLowerCase().includes('column')) {
        ({ data, error } = await admin.from('messages').update({ content }).eq('id', id).select().single());
      }
      if (error) return err(error.message, 400);
      return json({ message: data });
    }

    if (path.match(/^messages\/[^/]+$/) && method === 'DELETE') {
      const id = path.split('/')[1];
      const url = new URL(request.url);
      const mode = url.searchParams.get('mode') || 'me';
      const { data: current } = await admin.from('messages').select('*').eq('id', id).maybeSingle();
      if (!current) return err('Message not found', 404);
      if (current.sender_id !== me.id && current.receiver_id !== me.id) return err('Forbidden', 403);
      if (mode === 'everyone') {
        if (current.sender_id !== me.id) return err('Only sender can delete for everyone', 403);
        let { data, error } = await admin.from('messages').update({ content: 'This message was deleted', deleted_for_everyone: true }).eq('id', id).select().single();
        if (error && String(error.message || '').toLowerCase().includes('column')) {
          ({ data, error } = await admin.from('messages').update({ content: 'This message was deleted' }).eq('id', id).select().single());
        }
        if (error) return err(error.message, 400);
        return json({ message: data });
      }
      const deletedFor = Array.isArray(current.deleted_for) ? Array.from(new Set([...current.deleted_for, me.id])) : [me.id];
      const { data, error } = await admin.from('messages').update({ deleted_for: deletedFor }).eq('id', id).select().single();
      if (error && String(error.message || '').toLowerCase().includes('column')) {
        return json({ ok: true, local_only: true });
      }
      if (error) return err(error.message, 400);
      return json({ message: data });
    }

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
