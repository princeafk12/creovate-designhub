import {firestoreAdminCreate, firestoreAdminQuery, firestoreAdminWrite, json, safeEqual, sendEmail} from '../../_lib/firebase.js';

const OWNER_EMAIL = 'olanitealabij2023@gmail.com';

function base64(bytes) {
  let binary = '';
  new Uint8Array(bytes).forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function base64url(value) {
  return base64(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function hmacSignature(rawBody, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
  return base64(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody)));
}

async function validSignature(request, rawBody, secretHash) {
  if (!secretHash) return false;
  const legacy = request.headers.get('verif-hash') || '';
  if (legacy && safeEqual(legacy, secretHash)) return true;
  const modern = request.headers.get('flutterwave-signature') || '';
  return modern ? safeEqual(modern, await hmacSignature(rawBody, secretHash)) : false;
}

async function eventDocumentId(eventKey) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(eventKey));
  return `flw-${base64url(digest)}`;
}

async function notify(env, payload) {
  try { await sendEmail(env, payload); } catch (error) { console.error('CREOVATE payment email failed', error); }
}

export async function onRequestPost({request, env}) {
  const raw = await request.text();
  if (!(await validSignature(request, raw, env.FLW_SECRET_HASH))) return new Response('', {status: 401});

  let payload;
  try { payload = JSON.parse(raw); } catch { return new Response('', {status: 400}); }
  const data = payload?.data || {};
  const transactionId = String(data.id || '').trim();
  if (!transactionId) return new Response('', {status: 200});

  try {
    if (!env.FLW_SECRET_KEY) return new Response('', {status: 503});
    const verificationResponse = await fetch(`https://api.flutterwave.com/v3/transactions/${encodeURIComponent(transactionId)}/verify`, {
      headers: {authorization: `Bearer ${env.FLW_SECRET_KEY}`}
    });
    const verification = await verificationResponse.json().catch(() => ({}));
    const transaction = verification?.data;
    if (!verificationResponse.ok || verification?.status !== 'success' || !transaction?.tx_ref) return new Response('', {status: 200});

    const orders = await firestoreAdminQuery({env, collection: 'orders', where: [['tx_ref', String(transaction.tx_ref)]], limit: 1});
    const order = orders[0];
    if (!order) return new Response('', {status: 200});

    const transactionStatus = String(transaction.status || '').toLowerCase();
    const eventKey = `${payload?.event || 'unknown'}:${transaction.id}:${transactionStatus}`;
    const eventId = await eventDocumentId(eventKey);
    const currencyMatches = String(transaction.currency || '').toUpperCase() === String(order.currency || 'NGN').toUpperCase();
    const amountMatches = Number(transaction.amount) >= Number(order.price);
    const referenceMatches = String(transaction.tx_ref) === String(order.tx_ref);

    if (['failed', 'cancelled'].includes(transactionStatus)) {
      if (order.payment_status !== 'paid' && order.payment_status !== 'failed') {
        const failedOrder = {...order, payment_status: 'failed', updated_at: new Date().toISOString()};
        await firestoreAdminWrite({env, collection: 'orders', documentId: order.id, fields: failedOrder});
        await firestoreAdminCreate({env, collection: 'flutterwave_events', documentId: eventId, fields: {id: eventId, provider: 'flutterwave', event_key: eventKey, transaction_id: String(transaction.id), tx_ref: String(transaction.tx_ref), status: transactionStatus, received_at: new Date().toISOString(), processed_at: new Date().toISOString()}});
        const customerEmail = order.customer_email || order.brief?.email;
        if (customerEmail) await notify(env, {to: [customerEmail], subject: `Payment could not be confirmed for ${order.service_name}`, text: `Your payment for ${order.service_name} could not be confirmed. Please try again or contact CREOVATE.`, html: `<p>Your payment for <strong>${escapeHtml(order.service_name)}</strong> could not be confirmed. Please try again or contact CREOVATE.</p>`, idempotencyKey: `payment-failed-${order.id}`});
      }
      return new Response('', {status: 200});
    }

    if (transactionStatus !== 'successful' || !amountMatches || !currencyMatches || !referenceMatches) return new Response('', {status: 200});
    if (order.payment_status === 'paid') return new Response('', {status: 200});

    const paidAt = new Date().toISOString();
    const paidOrder = {...order, payment_status: 'paid', paid_at: paidAt, payment_verified_at: paidAt, flutterwave_transaction_id: String(transaction.id), updated_at: paidAt};
    await firestoreAdminWrite({env, collection: 'orders', documentId: order.id, fields: paidOrder});
    const event = await firestoreAdminCreate({env, collection: 'flutterwave_events', documentId: eventId, fields: {id: eventId, provider: 'flutterwave', event_key: eventKey, transaction_id: String(transaction.id), tx_ref: String(transaction.tx_ref), status: transactionStatus, received_at: paidAt, processed_at: paidAt}});
    if (!event.created) return new Response('', {status: 200});

    const customerEmail = order.customer_email || order.brief?.email;
    if (customerEmail) await notify(env, {to: [customerEmail], subject: `Payment confirmed for ${order.service_name}`, text: `Your payment for ${order.service_name} was confirmed.`, html: `<p>Your payment for <strong>${escapeHtml(order.service_name)}</strong> was confirmed.</p>`, idempotencyKey: `payment-confirmed-${order.id}`});
    const ownerEmail = env.OWNER_NOTIFICATION_EMAIL || OWNER_EMAIL;
    await notify(env, {to: [ownerEmail], subject: `New paid CREOVATE order: ${order.service_name}`, text: `A customer paid for ${order.service_name}. Reference: ${order.tx_ref}`, html: `<p>A customer paid for <strong>${escapeHtml(order.service_name)}</strong>.</p><p>Reference: ${escapeHtml(order.tx_ref)}</p>`, idempotencyKey: `owner-paid-${order.id}`});
    return new Response('', {status: 200});
  } catch (error) {
    console.error('CREOVATE Flutterwave webhook failed', error);
    return new Response('', {status: 500});
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[character]));
}
