import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAdmin, getUserFromRequest } from '@/lib/supabase/admin';

const json = (data, status = 200) => NextResponse.json(data, { status });

const allowedPlans = {
  worker: ['Basic', 'Growth', 'Premium'],
  employer: ['Starter', 'Business', 'Enterprise'],
};

function planValidityMonths(role, planName) {
  const workerValidity = { Basic: 1, Growth: 6, Premium: 12 };
  const employerValidity = { Starter: 1, Business: 6, Enterprise: 12 };
  const map = role === 'employer' ? employerValidity : workerValidity;
  return map[planName] || 1;
}

function planExpiryDate(role, planName, start = new Date()) {
  const d = new Date(start);
  d.setMonth(d.getMonth() + planValidityMonths(role, planName));
  return d;
}

export async function POST(request) {
  try {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) return json({ error: 'Razorpay secret is not configured.' }, 500);

    const me = await getUserFromRequest(request).catch(() => null);
    if (!me?.id) return json({ error: 'Unauthorized. Please login again.' }, 401);

    const body = await request.json().catch(() => ({}));
    const orderId = body.razorpay_order_id;
    const paymentId = body.razorpay_payment_id;
    const signature = body.razorpay_signature;
    const role = body.role === 'employer' ? 'employer' : 'worker';
    const planName = String(body.plan_name || '').trim();

    if (!orderId || !paymentId || !signature) return json({ error: 'Payment details are missing.' }, 400);
    if (!allowedPlans[role]?.includes(planName)) return json({ error: 'Invalid subscription plan.' }, 400);

    const expected = crypto
      .createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    if (expected !== signature) return json({ error: 'Payment signature verification failed.' }, 400);

    try {
      const admin = getAdmin();
      await admin.from('user_subscriptions')
        .update({ status: 'inactive', updated_at: new Date().toISOString() })
        .eq('user_id', me.id)
        .eq('role', role)
        .eq('status', 'active');

      const startedAt = new Date();
      const expiresAt = planExpiryDate(role, planName, startedAt);
      const payload = {
        user_id: me.id,
        role,
        plan_name: planName,
        status: 'active',
        source: 'razorpay',
        validity_months: planValidityMonths(role, planName),
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        started_at: startedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      };
      await admin.from('user_subscriptions').insert(payload);
      await admin.from('user_profiles')
        .update({ subscription_plan: planName, subscription_status: 'active', subscription_expiry: payload.expires_at })
        .eq('id', me.id);
    } catch (dbError) {
      // Signature is valid, so do not fail the payment because optional subscription columns may be missing.
      console.warn('Subscription DB save skipped:', dbError?.message);
    }

    return json({ success: true, verified: true, plan_name: planName, role, payment_id: paymentId, expires_at: planExpiryDate(role, planName).toISOString(), validity_months: planValidityMonths(role, planName) });
  } catch (error) {
    return json({ error: error.message || 'Payment verification failed' }, 500);
  }
}
