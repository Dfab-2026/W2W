import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAdmin, getUserFromRequest } from '@/lib/supabase/admin';

const json = (data, status = 200) => NextResponse.json(data, { status });

function getRazorpayKeyId() {
  return process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';
}

function verifySignature({ orderId, paymentId, signature, keySecret }) {
  const expected = crypto.createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function fetchPayment(paymentId) {
  const keyId = getRazorpayKeyId();
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const res = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    method: 'GET',
    headers: { Authorization: `Basic ${auth}` },
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.description || 'Unable to verify Razorpay payment.');
  return data;
}

export async function POST(request) {
  try {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) return json({ error: 'Razorpay secret is not configured.' }, 500);
    const me = await getUserFromRequest(request).catch(() => null);
    if (!me?.id) return json({ error: 'Unauthorized. Please login again.' }, 401);

    const body = await request.json().catch(() => ({}));
    const appId = String(body.application_id || '').trim();
    const orderId = body.razorpay_order_id;
    const paymentId = body.razorpay_payment_id;
    const signature = body.razorpay_signature;
    if (!appId || !orderId || !paymentId || !signature) return json({ error: 'Payment details are missing.' }, 400);
    if (!verifySignature({ orderId, paymentId, signature, keySecret })) return json({ error: 'Payment signature verification failed.' }, 400);

    const admin = getAdmin();
    const { data: appRow } = await admin
      .from('applications')
      .select('id,status,worker_id,jobs!inner(id,title,employer_id)')
      .eq('id', appId)
      .maybeSingle();
    if (!appRow) return json({ error: 'Application not found.' }, 404);
    if (appRow.jobs?.employer_id !== me.id) return json({ error: 'Forbidden.' }, 403);

    const payment = await fetchPayment(paymentId);
    if (payment?.order_id && payment.order_id !== orderId) return json({ error: 'Payment order mismatch.' }, 400);
    if (payment?.status && !['captured', 'authorized'].includes(payment.status)) return json({ error: `Payment is not completed. Current status: ${payment.status}` }, 400);

    const completedAt = new Date().toISOString();
    const { data: updatedApp, error: updateError } = await admin.from('applications')
      .update({ status: 'completed', completed_at: completedAt })
      .eq('id', appId)
      .select()
      .single();
    if (updateError) {
      const { data: fallbackApp, error: fallbackError } = await admin.from('applications')
        .update({ status: 'completed' })
        .eq('id', appId)
        .select()
        .single();
      if (fallbackError) throw new Error(fallbackError.message);
      try { await admin.from('application_payments').update({ status: 'captured', razorpay_payment_id: paymentId, raw_response: payment, updated_at: completedAt }).eq('razorpay_order_id', orderId); } catch {}
      return json({ success: true, application: fallbackApp, payment_id: paymentId });
    }

    try {
      await admin.from('application_payments').update({
        status: payment?.status || 'captured',
        razorpay_payment_id: paymentId,
        raw_response: payment,
        updated_at: completedAt,
      }).eq('razorpay_order_id', orderId);
    } catch (e) {
      console.warn('application_payments update skipped:', e?.message);
    }

    try {
      await admin.from('notifications').insert({
        user_id: appRow.worker_id,
        title: 'Payment completed',
        message: `Payment for ${appRow.jobs?.title || 'your completed job'} was processed by the employer.`,
        type: 'payment',
        related_id: appId,
        created_at: completedAt,
      });
    } catch {}

    return json({ success: true, application: updatedApp, payment_id: paymentId });
  } catch (error) {
    return json({ error: error.message || 'Payment verification failed.' }, 500);
  }
}
