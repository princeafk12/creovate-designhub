import {publicToolCatalog} from '../../_lib/business-tools.js';
import {firebaseUser, firestoreAdminGet, json} from '../../_lib/firebase.js';

export async function onRequestGet({request, env}) {
  const provider = String(env.AI_PROVIDER || 'gemini').toLowerCase();
  const aiReady = provider === 'gemini' ? Boolean(env.GEMINI_API_KEY && env.GEMINI_MODEL) : provider === 'openai' && env.AI_PAID_PROVIDER_ENABLED === 'true' ? Boolean(env.OPENAI_API_KEY && env.OPENAI_MODEL) : false;
  const liveFlutterwaveKey = Boolean(env.FLW_SECRET_KEY) && !/_TEST-/i.test(env.FLW_SECRET_KEY);
  let capacityAvailable = Boolean(env.FIREBASE_SERVICE_ACCOUNT_JSON);
  try {
    const usageDay = new Date().toISOString().slice(0, 10);
    const globalUsage = await firestoreAdminGet({env, collection: 'generation_usage', documentId: `all_${usageDay}`});
    const globalLimit = Math.max(1, Math.min(20, Number(env.AI_GLOBAL_DAILY_LIMIT || 10)));
    capacityAvailable = Number(globalUsage?.count || 0) < globalLimit;
    const user = await firebaseUser(request, env);
    if (user) {
      const userUsage = await firestoreAdminGet({env, collection: 'generation_usage', documentId: `${user.uid}_${usageDay}`});
      const userLimit = Math.max(1, Math.min(20, Number(env.AI_DAILY_LIMIT || 5)));
      if (Number(userUsage?.count || 0) >= userLimit) capacityAvailable = false;
    }
  } catch { capacityAvailable = false; }
  const enabled = env.PROMO_STUDIO_ENABLED === 'true' && env.GENERATION_PAUSED === 'false' && env.PAYMENTS_READY === 'true' && aiReady && liveFlutterwaveKey && capacityAvailable;
  const notice = !liveFlutterwaveKey ? 'Live checkout is not ready: Production needs the Flutterwave Live secret key and matching live webhook hash.' : !enabled ? 'Checkout is temporarily paused while payment, AI availability or daily capacity is checked.' : '';
  return json({tools: publicToolCatalog(), enabled, notice}, 200, {'cache-control': 'private, no-store'});
}
