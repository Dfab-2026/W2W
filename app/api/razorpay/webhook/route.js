import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAdmin } from '@/lib/supabase/admin';

const json = (data, status = 200) => NextResponse.json(data, { status });

function isValidWebhookSignature(rawBody, signature, secret) {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(request) {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) return json({ error: 'Webhook secret missing' }, 500);

    const rawBody = await request.text();
    const signature = request.headers.get('x-razorpay-signature');
    if (!isValidWebhookSignature(rawBody, signature, webhookSecret)) {
      return json({ error: 'Invalid webhook signature' }, 400);
    }

    const event = JSON.parse(rawBody);
    const payment = event?.payload?.payment?.entity || null;
    const order = event?.payload?.order?.entity || null;
    const paymentId = payment?.id || null;
    const orderId = payment?.order_id || order?.id || null;

    if (paymentId || orderId) {
      try {
        const admin = getAdmin();
        await admin.from('subscription_payments').upsert({
          razorpay_payment_id: paymentId,
          razorpay_order_id: orderId,
          amount: payment?.amount || order?.amount || null,
          currency: payment?.currency || order?.currency || 'INR',
          status: payment?.status || order?.status || event?.event || 'received',
          raw_response: event,
          updated_at: new Date().toISOString(),
        }, { onConflict: paymentId ? 'razorpay_payment_id' : 'razorpay_order_id' });
      } catch (e) {
        console.warn('Webhook payment save skipped:', e?.message);
      }
    }

    return json({ success: true, received: true });
  } catch (error) {
    return json({ error: error.message || 'Webhook handling failed' }, 500);
  }
}
