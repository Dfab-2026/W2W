import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAdmin, getUserFromRequest } from '@/lib/supabase/admin';

const json = (data, status = 200) => NextResponse.json(data, { status });

const allowedPlans = {
  worker: { Basic: 19900, Growth: 29900, Premium: 59900 },
  employer: { Starter: 99900, Business: 499900, Enterprise: 899900 },
};

function getRazorpayKeyId() {
  return process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';
}

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

function verifySignature({ orderId, paymentId, signature, keySecret }) {
  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function fetchRazorpayPayment(paymentId) {
  const keyId = getRazorpayKeyId();
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const res = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    method: 'GET',
    headers: { Authorization: `Basic ${auth}` },
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.description || 'Unable to verify payment with Razorpay');
  return data;
}

async function savePaymentAndSubscription({ admin, me, role, planName, orderId, paymentId, payment }) {
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

  await admin.from('user_subscriptions')
    .update({ status: 'inactive', updated_at: new Date().toISOString() })
    .eq('user_id', me.id)
    .eq('role', role)
    .eq('status', 'active');

  const { data: subscription, error: subError } = await admin.from('user_subscriptions').insert(payload).select().single();
  if (subError) throw new Error(subError.message);

  await admin.from('user_profiles')
    .update({ subscription_plan: planName, subscription_status: 'active', subscription_expiry: payload.expires_at })
    .eq('id', me.id);

  try {
    await admin.from('subscription_payments')
      .upsert({
        user_id: me.id,
        role,
        plan_name: planName,
        amount: payment?.amount || allowedPlans[role][planName],
        currency: payment?.currency || 'INR',
        status: payment?.status || 'captured',
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: null,
        subscription_id: subscription?.id || null,
        raw_response: payment || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'razorpay_payment_id' });
  } catch (e) {
    console.warn('Razorpay payment row save skipped:', e?.message);
  }

  return { subscription, expiresAt };
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
    if (!allowedPlans[role]?.[planName]) return json({ error: 'Invalid subscription plan.' }, 400);

    if (!verifySignature({ orderId, paymentId, signature, keySecret })) {
      return json({ error: 'Payment signature verification failed.' }, 400);
    }

    const payment = await fetchRazorpayPayment(paymentId);
    if (payment?.order_id && payment.order_id !== orderId) return json({ error: 'Payment order mismatch.' }, 400);
    if (payment?.amount && Number(payment.amount) !== Number(allowedPlans[role][planName])) return json({ error: 'Payment amount mismatch.' }, 400);
    if (payment?.status && !['captured', 'authorized'].includes(payment.status)) return json({ error: `Payment is not captured. Current status: ${payment.status}` }, 400);

    const admin = getAdmin();
    const { subscription, expiresAt } = await savePaymentAndSubscription({ admin, me, role, planName, orderId, paymentId, payment });

    return json({
      success: true,
      verified: true,
      subscription,
      plan_name: planName,
      role,
      payment_id: paymentId,
      expires_at: expiresAt.toISOString(),
      validity_months: planValidityMonths(role, planName),
    });
  } catch (error) {
    return json({ error: error.message || 'Payment verification failed' }, 500);
  }
}
