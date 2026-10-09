import {json, safeEqual, supabaseRest, sendEmail} from '../../_lib/supabase.js';

export async function onRequestPost({request, env}) {
  const signature = request.headers.get('verif-hash') || '';
  if (!env.FLW_SECRET_HASH || !safeEqual(signature, env.FLW_SECRET_HASH)) return new Response('', {status: 401});
  const raw = await request.text();
  let payload;
  try { payload = JSON.parse(raw); } catch { return new Response('', {status: 400}); }

  try {
    const data = payload?.data || {};
    const eventKey = `${payload?.event || 'unknown'}:${data.id || data.tx_ref || crypto.randomUUID()}:${data.status || 'unknown'}`;
    const eventInsert = await supabaseRest(env, 'webhook_events', {
      method: 'POST',
      headers: {prefer: 'return=minimal'},
      body: {provider: 'flutterwave', event_key: eventKey, payload}
    });
    if (eventInsert.response.status === 409) return new Response('', {status: 200});
    if (!eventInsert.response.ok) return new Response('', {status: 500});

    if (!data.id) return new Response('', {status: 200});
    const verificationResponse = await fetch(`https://api.flutterwave.com/v3/transactions/${encodeURIComponent(data.id)}/verify`, {
      headers: {authorization: `Bearer ${env.FLW_SECRET_KEY}`}
    });
    const verification = await verificationResponse.json().catch(() => ({}));
    const transaction = verification?.data;
    if (!verificationResponse.ok || verification?.status !== 'success' || !transaction) return new Response('', {status: 200});

    const orders = await supabaseRest(env, `orders?tx_ref=eq.${encodeURIComponent(transaction.tx_ref)}&select=*`, {method: 'GET'});
    const order = orders.data?.[0];
    if (!order) return new Response('', {status: 200});
    if (['failed', 'cancelled'].includes(String(transaction.status).toLowerCase())) {
      const failed = await supabaseRest(env, `orders?id=eq.${encodeURIComponent(order.id)}&payment_status=eq.pending`, {
        method: 'PATCH', headers: {prefer: 'return=representation'}, body: {payment_status: 'failed'}
      });
      if (failed.response.ok && failed.data?.length && (order.customer_email || order.brief?.email)) {
        await trySendEmail(env, {
          to: [order.customer_email || order.brief.email],
          subject: `Payment could not be confirmed for ${order.service_name}`,
          text: `Your payment for ${order.service_name} could not be confirmed. Please try again or contact CREOVATE.`,
          html: `<p>Your payment for <strong>${escapeHtml(order.service_name)}</strong> could not be confirmed. Please try again or contact CREOVATE.</p>`,
          idempotencyKey: `payment-failed-${order.id}`
        });
      }
      return new Response('', {status: 200});
    }
    const amountMatches = Number(transaction.amount) >= Number(order?.price);
    const currencyMatches = String(transaction.currency || '') === String(order?.currency || 'NGN');
    if (transaction.status !== 'successful' || !amountMatches || !currencyMatches) return new Response('', {status: 200});
    if (order.payment_status === 'paid') return new Response('', {status: 200});

    const updated = await supabaseRest(env, `orders?id=eq.${encodeURIComponent(order.id)}&payment_status=eq.pending`, {
      method: 'PATCH',
      headers: {prefer: 'return=representation'},
      body: {payment_status: 'paid', paid_at: new Date().toISOString(), payment_verified_at: new Date().toISOString(), flutterwave_transaction_id: String(transaction.id)}
    });
    if (updated.response.ok && updated.data?.length) {
      await supabaseRest(env, `webhook_events?event_key=eq.${encodeURIComponent(eventKey)}`, {
        method: 'PATCH', headers: {prefer: 'return=minimal'}, body: {processed_at: new Date().toISOString()}
      });
      const customerEmail = order.customer_email || order.brief?.email;
      if (customerEmail) {
        await trySendEmail(env, {
          to: [customerEmail],
          subject: `Payment confirmed for ${order.service_name}`,
          text: `Your payment for ${order.service_name} was confirmed.`,
          html: `<p>Your payment for <strong>${escapeHtml(order.service_name)}</strong> was confirmed.</p>`,
          idempotencyKey: `payment-confirmed-${order.id}`
        });
      }
      if (env.OWNER_NOTIFICATION_EMAIL) {
        await trySendEmail(env, {
          to: [env.OWNER_NOTIFICATION_EMAIL],
          subject: `New paid CREOVATE order: ${order.service_name}`,
          text: `A customer paid for ${order.service_name}. Reference: ${order.tx_ref}`,
          html: `<p>A customer paid for <strong>${escapeHtml(order.service_name)}</strong>.</p><p>Reference: ${escapeHtml(order.tx_ref)}</p>`,
          idempotencyKey: `owner-paid-${order.id}`
        });
      }
    }
    return new Response('', {status: 200});
  } catch {
    return new Response('', {status: 500});
  }
}

async function trySendEmail(env, payload) {
  try {
    await sendEmail(env, payload);
  } catch (error) {
    console.error('CREOVATE email notification failed', error);
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[character]));
}
