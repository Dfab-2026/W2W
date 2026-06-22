import { NextResponse } from 'next/server';
import { getAdmin, getUserFromRequest } from '@/lib/supabase/admin';

const json = (data, status = 200) => NextResponse.json(data, { status });

const allowedPlans = {
  worker: { Basic: 9900, Growth: 29900, Premium: 59900 },
  employer: { Starter: 99900, Business: 499900, Enterprise: 899900 },
};

const planValidityMonths = {
  worker: { Basic: 1, Growth: 6, Premium: 12 },
  employer: { Starter: 1, Business: 6, Enterprise: 12 },
};

function getRazorpayKeyId() {
  return process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';
}

function receiptId(userId = 'user', role = 'worker', plan = 'plan') {
  const safeUser = String(userId).replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || 'user';
  const safeRole = String(role).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'role';
  const safePlan = String(plan).replace(/[^a-zA-Z0-9]/g, '').slice(0, 12) || 'plan';
  return `w2w_${safeRole}_${safePlan}_${safeUser}_${Date.now()}`.slice(0, 40);
}

async function saveOrderDraft({ userId, role, planName, order }) {
  try {
    const admin = getAdmin();
    await admin.from('subscription_payments').insert({
      user_id: userId,
      role,
      plan_name: planName,
      amount: order.amount,
      currency: order.currency || 'INR',
      status: order.status || 'created',
      razorpay_order_id: order.id,
      raw_response: order,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    // Optional table. Never block order creation if SQL has not been run yet.
    console.warn('Razorpay order draft save skipped:', e?.message);
  }
}

export async function POST(request) {
  try {
    const keyId = getRazorpayKeyId();
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return json({ error: 'Razorpay is not configured. Add RAZORPAY_KEY_ID, NEXT_PUBLIC_RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env.local / Vercel, then redeploy.' }, 500);
    }

    const me = await getUserFromRequest(request).catch(() => null);
    if (!me?.id) return json({ error: 'Unauthorized. Please login again.' }, 401);

    const body = await request.json().catch(() => ({}));
    const role = body.role === 'employer' ? 'employer' : 'worker';
    const planName = String(body.plan_name || '').trim();
    const fixedAmount = allowedPlans[role]?.[planName];
    if (!fixedAmount) return json({ error: 'Invalid subscription plan.' }, 400);

    // Security: amount is always calculated on server, never trusted from frontend.
    const orderPayload = {
      amount: fixedAmount,
      currency: 'INR',
      receipt: receiptId(me.id, role, planName),
      payment_capture: 1,
      notes: {
        user_id: me.id,
        role,
        plan_name: planName,
        validity_months: planValidityMonths[role]?.[planName] || 1,
        app: 'Work2Wish',
      },
    };

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
      cache: 'no-store',
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return json({ error: data?.error?.description || data?.message || 'Unable to create Razorpay order', raw: data }, 500);
    }

    await saveOrderDraft({ userId: me.id, role, planName, order: data });

    return json({ success: true, order: data });
  } catch (error) {
    return json({ error: error.message || 'Unable to create Razorpay order' }, 500);
  }
}
