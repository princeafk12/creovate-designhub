import {firebaseUser, firestoreAdminGet, firestoreAdminQuery, firestoreAdminWrite, json, sendEmail} from '../_lib/firebase.js';
import {BUSINESS_TOOLS, toolBrief} from '../_lib/business-tools.js';
import {releaseGenerationCapacity, releaseOrderCapacity, reserveGenerationCapacity} from '../_lib/generation-usage.js';
import {ageConfirmationReceived, geminiRegionAllowed} from '../_lib/ai-access.js';

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
  let allocatedReservation;
  let allocatedOrderId;
  try {
    const user = await firebaseUser(request, env);
    if (!user) return json({error: 'Sign in before creating an order.'}, 401);
    if (String(env.PAYMENTS_READY).toLowerCase() !== 'true') return json({error: 'Flutterwave checkout is not enabled yet. No payment was taken.'}, 503);
    if (!env.FLW_SECRET_KEY) return json({error: 'Flutterwave secret key is not configured. No payment was taken.'}, 503);
    if (/_TEST-/i.test(env.FLW_SECRET_KEY)) return json({error: 'Live checkout is not ready. Replace the Flutterwave test key with the Live key in Cloudflare Production. No payment was taken.'}, 503);
    if (!env.FLW_SECRET_HASH) return json({error: 'Live checkout is not ready. Add the matching Flutterwave Live webhook hash in Cloudflare Production. No payment was taken.'}, 503);

    const input = await request.json().catch(() => ({}));
    const serviceSlug = clean(input.service_slug, 80);
    const productSlug = clean(input.product_slug, 80);
    const briefInput = input.brief && typeof input.brief === 'object' ? input.brief : {};
    const brief = Object.fromEntries(Object.entries(briefInput).map(([key, value]) => [key, clean(value)]));
    const rush = Boolean(input.rush);
    const isToolOrder = Boolean(productSlug);
    const txRef = `creovate-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const orderId = crypto.randomUUID();
    let item;
    let price;
    let currency = 'NGN';
    let customerName = clean(input.customer_name, 160);
    let rushEnabled = false;
    if (isToolOrder) {
      item = BUSINESS_TOOLS[productSlug];
      if (!item) return json({error: 'That business tool is not available.'}, 400);
      if (env.PROMO_STUDIO_ENABLED !== 'true' || env.GENERATION_PAUSED !== 'false') {
        return json({error: 'Business tool checkout is temporarily paused. No payment was taken.'}, 503);
      }
      const provider = String(env.AI_PROVIDER || 'gemini').toLowerCase();
      const aiReady = provider === 'gemini' ? Boolean(env.GEMINI_API_KEY && env.GEMINI_MODEL) : provider === 'openai' && env.AI_PAID_PROVIDER_ENABLED === 'true' ? Boolean(env.OPENAI_API_KEY && env.OPENAI_MODEL) : false;
      if (!aiReady) return json({error: 'AI generation is temporarily unavailable. No payment was taken.'}, 503);
      if (provider === 'gemini' && !geminiRegionAllowed(request)) return json({error: 'AI checkout is not available in your current region with the configured Gemini service. No payment was taken.'}, 403);
      if (!ageConfirmationReceived(input.adult_confirmed)) return json({error: 'Confirm that you are 18 or older before using AI tools. No payment was taken.'}, 400);
      delete brief.adult_confirmed;
      try { Object.assign(brief, toolBrief(productSlug, brief)); }
      catch (error) { return json({error: error.message}, 400); }
      price = item.price;
      currency = item.currency;
      customerName = customerName || brief.business_name || user.email;
      const now = Date.now();
      const toolOrders = await firestoreAdminQuery({env, collection: 'orders', where: [['order_type', 'tool']], limit: 100});
      await Promise.all(toolOrders.filter(order => order.payment_status === 'pending' && order.usage_reservation?.status === 'reserved' && Date.parse(order.usage_reservation.expires_at || '') <= now).map(order => releaseOrderCapacity(env, order.id)));
      allocatedReservation = await reserveGenerationCapacity(env, user.uid, {
        reservationId: orderId,
        expiresAt: new Date(now + 30 * 60 * 1000).toISOString()
      });
    } else {
      if (!serviceSlug || !brief.name || !brief.email) return json({error: 'Service, name, and email are required.'}, 400);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(brief.email)) return json({error: 'Enter a valid email address.'}, 400);
      item = await readDocument(env, 'services', serviceSlug, FALLBACK_SERVICES[serviceSlug]);
      if (!item) return json({error: 'That service is not available.'}, 400);
      const settings = await readDocument(env, 'site_settings', '1', {launch_active: true, launch_spots_remaining: 15, rush_percent: 30});
      const launchActive = settings.launch_active !== false && Number(settings.launch_spots_remaining ?? 0) > 0;
      const standardPrice = Number(item.standard_price);
      const launchPrice = Number(item.launch_price);
      if (!Number.isInteger(standardPrice) || standardPrice < 0 || !Number.isInteger(launchPrice) || launchPrice < 0) return json({error: 'The selected service price is not configured correctly.'}, 503);
      const basePrice = launchActive ? launchPrice : standardPrice;
      rushEnabled = Boolean(item.rush_enabled);
      const rushRate = Number(item.rush_percent || settings.rush_percent || 30);
      price = rush && rushEnabled ? Math.round(basePrice * (1 + rushRate / 100)) : basePrice;
      customerName = customerName || brief.name;
    }
    allocatedOrderId = orderId;
    const createdAt = new Date().toISOString();
    const order = {
      id: orderId,
      user_id: user.uid,
      order_type: isToolOrder ? 'tool' : 'design',
      product_slug: isToolOrder ? productSlug : null,
      customer_email: user.email || String(brief.email || '').toLowerCase(),
      service_slug: isToolOrder ? null : serviceSlug,
      service_name: String(item.name || (isToolOrder ? productSlug : serviceSlug)),
      price,
      currency,
      tx_ref: txRef,
      rush: rush && rushEnabled,
      brief,
      ...(isToolOrder ? {adult_confirmed: true, adult_confirmed_at: createdAt} : {}),
      ...(allocatedReservation ? {usage_reservation: allocatedReservation} : {}),
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
        currency,
        redirect_url: `${appBaseUrl}/payment-return.html?order_id=${encodeURIComponent(orderId)}`,
        customer: {email: user.email || brief.email, name: customerName},
        meta: {order_id: orderId, user_id: user.uid, order_type: order.order_type, product_slug: productSlug || serviceSlug},
        customizations: {title: 'CREOVATE DesignHub', description: String(item.name || productSlug || serviceSlug)},
        ...(isToolOrder ? {configuration: {session_duration: 20, max_retry_attempt: 3}, link_expiration: new Date(Date.now() + 20 * 60 * 1000).toISOString()} : {})
      })
    });
    const paymentBody = await payment.json().catch(() => ({}));
    if (!payment.ok || paymentBody.status !== 'success' || !paymentBody.data?.link) {
      await firestoreAdminWrite({env, collection: 'orders', documentId: orderId, fields: {...order, status: 'cancelled', payment_status: 'failed', payment_error: `Flutterwave returned ${payment.status}`}}).catch(() => {});
      if (allocatedReservation) await releaseOrderCapacity(env, orderId);
      return json({error: 'Flutterwave could not start checkout.'}, 502);
    }

    await sendOrderEmail(env, {
      to: [user.email || brief.email],
      subject: `CREOVATE ${order.service_name} order received`,
      text: `Your CREOVATE order was received. Complete payment using the checkout link. Reference: ${txRef}`,
      html: `<p>Your CREOVATE order for <strong>${escapeHtml(order.service_name)}</strong> was received.</p><p>Complete payment to begin. Reference: ${escapeHtml(txRef)}</p>`,
      idempotencyKey: `order-received-${orderId}`
    });
    return json({order_id: orderId, tx_ref: txRef, checkout_url: paymentBody.data.link});
  } catch (error) {
    if (allocatedReservation) {
      const order = allocatedOrderId ? await firestoreAdminGet({env, collection: 'orders', documentId: allocatedOrderId}).catch(() => null) : null;
      if (order) await releaseOrderCapacity(env, allocatedOrderId);
      else await releaseGenerationCapacity(env, allocatedReservation);
    }
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
