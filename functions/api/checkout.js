import {firebaseUser, firestoreAdminGet, firestoreAdminWrite, json, sendEmail} from '../_lib/firebase.js';

const FALLBACK_SERVICES = {
  logo: {slug: 'logo', name: 'Logo design', launch_price: 5600, standard_price: 8000, rush_enabled: false, rush_percent: 30, delivery_time: '24 hours'},
  flyer: {slug: 'flyer', name: 'Flyer / poster', launch_price: 3500, standard_price: 5000, rush_enabled: false, rush_percent: 30, delivery_time: '24 hours'},
  'social-post': {slug: 'social-post', name: 'Social media post', launch_price: 2800, standard_price: 4000, rush_enabled: false, rush_percent: 30, delivery_time: '24 hours'},
  'social-pack': {slug: 'social-pack', name: 'Social media pack', launch_price: 24500, standard_price: 35000, rush_enabled: true, rush_percent: 30, delivery_time: '5 days'},
  'business-card': {slug: 'business-card', name: 'Business card', launch_price: 3500, standard_price: 5000, rush_enabled: false, rush_percent: 30, delivery_time: '24 hours'},
  'brand-kit': {slug: 'brand-kit', name: 'Full brand kit', launch_price: 42000, standard_price: 60000, rush_enabled: true, rush_percent: 30, delivery_time: '10 days'}
};

const clean = (value, max = 600) => String(value ?? '').trim().slice(0, max);

async function readDocument(env, collection, documentId, fallback = null) {
  return await firestoreAdminGet({env, collection, documentId}) || fallback;
}

export async function onRequestPost({request, env}) {
  try {
    const user = await firebaseUser(request, env);
    if (!user) return json({error: 'Sign in before creating an order.'}, 401);
    if (String(env.PAYMENTS_READY).toLowerCase() !== 'true') return json({error: 'Flutterwave checkout is not enabled yet. No payment was taken.'}, 503);
    if (!env.FLW_SECRET_KEY) return json({error: 'Flutterwave test credentials are not configured yet.'}, 503);

    const input = await request.json().catch(() => ({}));
    const serviceSlug = clean(input.service_slug, 80);
    const briefInput = input.brief && typeof input.brief === 'object' ? input.brief : {};
    const brief = Object.fromEntries(Object.entries(briefInput).map(([key, value]) => [key, clean(value)]));
    const rush = Boolean(input.rush);
    if (!serviceSlug || !brief.name || !brief.email) return json({error: 'Service, name, and email are required.'}, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(brief.email)) return json({error: 'Enter a valid email address.'}, 400);

    const service = await readDocument(env, 'services', serviceSlug, FALLBACK_SERVICES[serviceSlug]);
    if (!service) return json({error: 'That service is not available.'}, 400);
    const settings = await readDocument(env, 'site_settings', '1', {launch_active: true, launch_spots_remaining: 15, rush_percent: 30});
    const launchActive = settings.launch_active !== false && Number(settings.launch_spots_remaining ?? 0) > 0;
    const standardPrice = Number(service.standard_price);
    const launchPrice = Number(service.launch_price);
    if (!Number.isInteger(standardPrice) || standardPrice < 0 || !Number.isInteger(launchPrice) || launchPrice < 0) return json({error: 'The selected service price is not configured correctly.'}, 503);
    const basePrice = launchActive ? launchPrice : standardPrice;
    const rushEnabled = Boolean(service.rush_enabled);
    const rushRate = Number(service.rush_percent || settings.rush_percent || 30);
    const price = rush && rushEnabled ? Math.round(basePrice * (1 + rushRate / 100)) : basePrice;
    const txRef = `creovate-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const orderId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const order = {
      id: orderId,
      user_id: user.uid,
      customer_email: user.email || brief.email.toLowerCase(),
      service_slug: serviceSlug,
      service_name: String(service.name || serviceSlug),
      price,
      currency: 'NGN',
      tx_ref: txRef,
      rush: rush && rushEnabled,
      brief,
      status: 'new',
      payment_status: 'pending',
      created_at: createdAt
    };
    await firestoreAdminWrite({env, collection: 'orders', documentId: orderId, fields: order});

    const appBaseUrl = String(env.APP_BASE_URL || new URL(request.url).origin).replace(/\/$/, '');
    const payment = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {authorization: `Bearer ${env.FLW_SECRET_KEY}`, 'content-type': 'application/json'},
      body: JSON.stringify({
        tx_ref: txRef,
        amount: price,
        currency: 'NGN',
        redirect_url: `${appBaseUrl}/payment-return.html`,
        customer: {email: user.email || brief.email, name: brief.name},
        meta: {order_id: orderId, user_id: user.uid, service_slug: serviceSlug},
        customizations: {title: 'CREOVATE DesignHub', description: String(service.name || serviceSlug)}
      })
    });
    const paymentBody = await payment.json().catch(() => ({}));
    if (!payment.ok || paymentBody.status !== 'success' || !paymentBody.data?.link) {
      await firestoreAdminWrite({env, collection: 'orders', documentId: orderId, fields: {...order, status: 'cancelled', payment_status: 'failed', payment_error: `Flutterwave returned ${payment.status}`}}).catch(() => {});
      return json({error: 'Flutterwave could not start checkout.'}, 502);
    }

    await sendOrderEmail(env, {
      to: [user.email || brief.email],
      subject: `CREOVATE order ${order.service_name} received`,
      text: `Your CREOVATE order was received. Complete payment using the checkout link. Reference: ${txRef}`,
      html: `<p>Your CREOVATE order for <strong>${escapeHtml(order.service_name)}</strong> was received.</p><p>Complete payment to begin. Reference: ${escapeHtml(txRef)}</p>`,
      idempotencyKey: `order-received-${orderId}`
    });
    return json({order_id: orderId, tx_ref: txRef, checkout_url: paymentBody.data.link});
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Checkout failed.';
    const configError = /configuration|not configured/i.test(message);
    return json({error: configError ? message : 'Checkout failed.'}, configError ? 503 : 500);
  }
}

async function sendOrderEmail(env, payload) {
  try { await sendEmail(env, payload); } catch (error) { console.error('CREOVATE order email failed', error); }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[character]));
}
