import {firebaseUser, firestoreAdminGet, firestoreAdminWrite, json} from '../_lib/firebase.js';

const fields = ['business_name', 'business_category', 'offer', 'campaign_category', 'target_audience', 'selling_point', 'price', 'objective', 'contact', 'tone', 'platforms'];
const outputKeys = ['campaign_strategy', 'target_audience_angle', 'headlines', 'main_promotional_copy', 'flyer_ready_text', 'whatsapp_message', 'instagram_caption', 'facebook_post', 'x_post', 'call_to_actions', 'hashtags', 'visual_direction'];
const clean = value => String(value ?? '').trim();
const dayKey = () => new Date().toISOString().slice(0, 10);

function promptFor(input) {
  return `You are the CREOVATE Promo Studio copy strategist. Create a practical promotional campaign package for this business. Be specific, concise, culturally appropriate for the stated audience and location, and do not invent facts, guarantees, testimonials, discounts, prices, contacts or claims. Return valid JSON only with exactly these keys: ${outputKeys.join(', ')}. Use arrays for headlines, call_to_actions and hashtags; use strings for all other keys.\n\nBusiness input:\n${JSON.stringify(input, null, 2)}`;
}

function parseOutput(text) {
  const raw = String(text || '').trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  try { return JSON.parse(raw); } catch { return {main_promotional_copy: raw}; }
}

export async function onRequestPost({request, env}) {
  if (env.PROMO_STUDIO_ENABLED !== 'true' || env.GENERATION_PAUSED !== 'false' || env.PAYMENTS_READY !== 'true') {
    return json({error: 'Promo Studio generation is not enabled yet. No payment was taken. The owner must finish provider, payment, and safety checks first.'}, 503);
  }
  const user = await firebaseUser(request, env);
  if (!user) return json({error: 'Sign in before using Promo Studio.'}, 401);
  if (String(env.AI_PROVIDER || 'gemini').toLowerCase() !== 'gemini' || !env.GEMINI_API_KEY || !env.GEMINI_MODEL || !env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return json({error: 'The secure AI provider is not configured yet. No payment was taken.'}, 503);
  }

  const input = await request.json().catch(() => null);
  if (!input || typeof input !== 'object') return json({error: 'Send a valid Promo Studio brief.'}, 400);
  const brief = Object.fromEntries(fields.map(key => [key, clean(input[key])]));
  const required = ['business_name', 'business_category', 'offer', 'campaign_category', 'target_audience', 'selling_point', 'objective', 'tone', 'platforms'];
  if (required.some(key => !brief[key])) return json({error: 'Complete all required Promo Studio fields first.'}, 400);
  if (Object.values(brief).some(value => value.length > 600)) return json({error: 'One or more fields are too long. Please shorten the brief.'}, 413);

  const limit = Math.max(1, Number(env.AI_DAILY_LIMIT || 5));
  const usageId = `${user.uid}_${dayKey()}`;
  const jobId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  let usage;
  try {
    usage = await firestoreAdminGet({env, collection: 'generation_usage', documentId: usageId}) || {user_id: user.uid, day: dayKey(), count: 0};
    if (Number(usage.count || 0) >= limit) return json({error: `Your daily Promo Studio limit of ${limit} generations has been reached. Try again tomorrow.`}, 429);
    usage.count = Number(usage.count || 0) + 1;
    await firestoreAdminWrite({env, collection: 'generation_usage', documentId: usageId, fields: usage});
    await firestoreAdminWrite({env, collection: 'generation_jobs', documentId: jobId, fields: {user_id: user.uid, product: 'promo_studio', status: 'processing', created_at: createdAt, brief}});

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({contents: [{role: 'user', parts: [{text: promptFor(brief)}]}], generationConfig: {temperature: 0.7, maxOutputTokens: 2200, responseMimeType: 'application/json'}})
    });
    const providerBody = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(providerBody.error?.message || `The AI provider returned ${response.status}.`);
    const text = providerBody.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim();
    if (!text) throw new Error('The AI provider returned no campaign result.');
    const result = parseOutput(text);
    await firestoreAdminWrite({env, collection: 'generation_jobs', documentId: jobId, fields: {user_id: user.uid, product: 'promo_studio', status: 'completed', created_at: createdAt, completed_at: new Date().toISOString(), brief, result}});
    return json({job_id: jobId, product: 'promo_studio', result}, 200);
  } catch (error) {
    try {
      if (usage) await firestoreAdminWrite({env, collection: 'generation_usage', documentId: usageId, fields: {...usage, count: Math.max(0, Number(usage.count || 1) - 1)}});
      await firestoreAdminWrite({env, collection: 'generation_jobs', documentId: jobId, fields: {user_id: user.uid, product: 'promo_studio', status: 'failed', created_at: createdAt, failed_at: new Date().toISOString(), error: String(error.message || 'Generation failed').slice(0, 300)}});
    } catch {}
    return json({error: 'Promo Studio could not complete this generation. No successful result was saved.'}, 502);
  }
}
