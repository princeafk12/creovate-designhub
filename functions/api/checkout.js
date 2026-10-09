import {currentUser, json, supabaseRest, supabaseBase, sendEmail} from '../_lib/supabase.js';

export async function onRequestPost({request, env}) {
  try {
    const user = await currentUser(request, env);
    if (!user) return json({error: 'Sign in before creating an order.'}, 401);
    const input = await request.json();
    const serviceSlug = String(input.service_slug || '').trim();
    const brief = input.brief && typeof input.brief === 'object' ? input.brief : {};
    const rush = Boolean(input.rush);
    if (!serviceSlug || !String(brief.name || '').trim() || !String(brief.email || '').trim()) {
      return json({error: 'Service, name, and email are required.'}, 400);
    }
    if (!env.FLW_SECRET_KEY) return json({error: 'Flutterwave is not configured yet.'}, 503);

    const txRef = `creovate-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const insert = await supabaseRest(env, 'orders', {
      method: 'POST',
      headers: {prefer: 'return=representation'},
      body: {
        user_id: user.id,
        customer_email: String(user.email || brief.email).toLowerCase(),
        service_slug: serviceSlug,
        service_name: '',
        price: 0,
        currency: 'NGN',
        tx_ref: txRef,
        rush,
        brief,
        status: 'new',
        payment_status: 'pending'
      }
    });
    if (!insert.response.ok || !insert.data?.[0]) {
      return json({error: 'The order could not be created.', detail: insert.data}, 400);
    }
    const order = insert.data[0];
    const payment = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {authorization: `Bearer ${env.FLW_SECRET_KEY}`, 'content-type': 'application/json'},
      body: JSON.stringify({
        tx_ref: txRef,
        amount: order.price,
        currency: order.currency || 'NGN',
        redirect_url: `${(env.APP_BASE_URL || new URL(request.url).origin).replace(/\/$/, '')}/payment-return.html`,
        customer: {email: String(user.email || brief.email), name: String(brief.name || '')},
        customizations: {title: 'CREOVATE DesignHub', description: order.service_name}
      })
    });
    const paymentBody = await payment.json().catch(() => ({}));
    if (!payment.ok || paymentBody.status !== 'success' || !paymentBody.data?.link) {
      await supabaseRest(env, `orders?id=eq.${encodeURIComponent(order.id)}`, {
        method: 'PATCH', headers: {prefer: 'return=minimal'}, body: {status: 'cancelled'}
      });
      return json({error: 'Flutterwave could not start checkout.'}, 502);
    }

    await trySendEmail(env, {
      to: [String(user.email || brief.email)],
      subject: `CREOVATE order ${order.service_name} received`,
      text: `Your CREOVATE order was received. Complete payment using the checkout link. Reference: ${txRef}`,
      html: `<p>Your CREOVATE order for <strong>${escapeHtml(order.service_name)}</strong> was received.</p><p>Complete payment to begin. Reference: ${escapeHtml(txRef)}</p>`,
      idempotencyKey: `order-received-${order.id}`
    });
    return json({order_id: order.id, tx_ref: txRef, checkout_url: paymentBody.data.link});
  } catch (error) {
    return json({error: error instanceof Error ? error.message : 'Checkout failed.'}, 500);
  }
}

async function trySendEmail(env, payload) {
  try {
    await sendEmail(env, payload);
  } catch (error) {
    console.error('CREOVATE order email failed', error);
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[character]));
}
