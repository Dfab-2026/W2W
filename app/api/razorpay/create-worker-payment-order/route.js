import { NextResponse } from 'next/server';
import { getAdmin, getUserFromRequest } from '@/lib/supabase/admin';

const json = (data, status = 200) => NextResponse.json(data, { status });

function getRazorpayKeyId() {
  return process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';
}

function calcPayAmountPaise(job = {}) {
  const daily = Number(job.daily_pay || 0);
  const hourly = Number(job.hourly_pay || 0);
  const hours = Number(job.duration_hours || job.hours_duration || 0);
  const days = Number(job.duration_days || 1) || 1;
  const rupees = hourly > 0 ? hourly * (hours || 1) : daily * days;
  return Math.max(100, Math.round((Number.isFinite(rupees) ? rupees : 0) * 100));
}

export async function POST(request) {
  try {
    const keyId = getRazorpayKeyId();
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) return json({ error: 'Razorpay is not configured.' }, 500);

    const me = await getUserFromRequest(request).catch(() => null);
    if (!me?.id) return json({ error: 'Unauthorized. Please login again.' }, 401);

    const body = await request.json().catch(() => ({}));
    const appId = String(body.application_id || '').trim();
    if (!appId) return json({ error: 'Application is required.' }, 400);

    const admin = getAdmin();
    const { data: appRow, error: appError } = await admin
      .from('applications')
      .select('id,status,worker_id,jobs!inner(id,title,employer_id,daily_pay,hourly_pay,duration_hours,hours_duration,duration_days)')
      .eq('id', appId)
      .maybeSingle();
    if (appError) return json({ error: appError.message }, 400);
    if (!appRow) return json({ error: 'Application not found.' }, 404);
    if (appRow.jobs?.employer_id !== me.id) return json({ error: 'Forbidden.' }, 403);

    const amount = calcPayAmountPaise(appRow.jobs || {});
    const receipt = `w2w_pay_${String(appId).replace(/[^a-zA-Z0-9]/g, '').slice(0, 18)}_${Date.now()}`.slice(0, 40);
    const orderPayload = {
      amount,
      currency: 'INR',
      receipt,
      payment_capture: 1,
      notes: {
        app: 'Work2Wish',
        purpose: 'worker_payment',
        application_id: appId,
        job_id: appRow.jobs?.id || '',
        worker_id: appRow.worker_id || '',
        employer_id: me.id,
      },
    };

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload),
      cache: 'no-store',
    });
    const order = await res.json().catch(() => ({}));
    if (!res.ok) return json({ error: order?.error?.description || order?.message || 'Unable to create payment order.' }, 500);

    try {
      await admin.from('application_payments').insert({
        application_id: appId,
        employer_id: me.id,
        worker_id: appRow.worker_id,
        amount,
        currency: 'INR',
        status: order.status || 'created',
        razorpay_order_id: order.id,
        raw_response: order,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('application_payments draft save skipped:', e?.message);
    }

    return json({ success: true, order, amount, application_id: appId });
  } catch (error) {
    return json({ error: error.message || 'Unable to create worker payment order.' }, 500);
  }
}
