import {firestoreAdminGetWithMeta, firestoreAdminWrite} from './firebase.js';

const today = () => new Date().toISOString().slice(0, 10);

async function increment(env, id, initial, limit, label) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const snapshot = await firestoreAdminGetWithMeta({env, collection: 'generation_usage', documentId: id});
    const current = snapshot?.data || {count: 0, ...initial};
    if (Number(current.count || 0) >= limit) throw new Error(`${label} has reached today's generation limit. Try again tomorrow.`);
    try {
      await firestoreAdminWrite({
        env, collection: 'generation_usage', documentId: id,
        fields: {...current, count: Number(current.count || 0) + 1, updated_at: new Date().toISOString()},
        currentDocument: snapshot ? {updateTime: snapshot.updateTime} : {exists: false}
      });
      return;
    } catch (error) {
      if (!/precondition|failed precondition|conflict|already exists/i.test(error.message || '') || attempt === 4) throw error;
    }
  }
}

async function decrement(env, id) {
  if (!id) return;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const snapshot = await firestoreAdminGetWithMeta({env, collection: 'generation_usage', documentId: id});
    if (!snapshot?.data || Number(snapshot.data.count || 0) <= 0) return;
    try {
      await firestoreAdminWrite({
        env, collection: 'generation_usage', documentId: id,
        fields: {...snapshot.data, count: Number(snapshot.data.count) - 1, updated_at: new Date().toISOString()},
        currentDocument: {updateTime: snapshot.updateTime}
      });
      return;
    } catch (error) {
      if (!/precondition|failed precondition|conflict/i.test(error.message || '') || attempt === 4) throw error;
    }
  }
}

export async function reserveGenerationCapacity(env, userId, {expiresAt = null, reservationId = null} = {}) {
  const day = today();
  const globalId = `all_${day}`;
  const userIdForDay = `${userId}_${day}`;
  const globalLimit = Math.max(1, Math.min(20, Number(env.AI_GLOBAL_DAILY_LIMIT || 10)));
  const userLimit = Math.max(1, Math.min(20, Number(env.AI_DAILY_LIMIT || 5)));
  await increment(env, globalId, {day, usage_type: 'all-tools-and-validator'}, globalLimit, 'The site-wide CREOVATE AI limit');
  try {
    await increment(env, userIdForDay, {day, user_id: userId}, userLimit, 'Your daily AI limit');
  } catch (error) {
    await decrement(env, globalId).catch(() => {});
    throw error;
  }
  return {id: reservationId, day, global_usage_id: globalId, user_usage_id: userIdForDay, status: 'reserved', expires_at: expiresAt};
}

export async function releaseGenerationCapacity(env, reservation) {
  await Promise.all([
    decrement(env, reservation?.global_usage_id).catch(() => {}),
    decrement(env, reservation?.user_usage_id).catch(() => {})
  ]);
}

// A reservation is released only after the order is atomically marked as released,
// so webhook delivery and checkout cleanup cannot decrement the same hold twice.
export async function releaseOrderCapacity(env, orderId) {
  const snapshot = await firestoreAdminGetWithMeta({env, collection: 'orders', documentId: orderId});
  const order = snapshot?.data;
  const reservation = order?.usage_reservation;
  if (!order || order.payment_status === 'paid' || reservation?.status !== 'reserved') return false;
  const now = new Date().toISOString();
  const updated = {...order, usage_reservation: {...reservation, status: 'released', released_at: now}, updated_at: now};
  try {
    await firestoreAdminWrite({env, collection: 'orders', documentId: orderId, fields: updated, currentDocument: {updateTime: snapshot.updateTime}});
  } catch {
    return false;
  }
  await releaseGenerationCapacity(env, reservation);
  return true;
}
