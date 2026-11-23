import {firebaseUser, firestoreAdminGet, firestoreAdminGetWithMeta, firestoreAdminWrite, json} from '../_lib/firebase.js';

const PRODUCT = 'promo_studio';
const fields = ['business_name', 'business_category', 'offer', 'campaign_category', 'target_audience', 'selling_point', 'price', 'objective', 'contact', 'tone', 'platforms'];
const outputKeys = ['campaign_strategy', 'target_audience_angle', 'headlines', 'main_promotional_copy', 'flyer_ready_text', 'whatsapp_message', 'instagram_caption', 'facebook_post', 'x_post', 'call_to_actions', 'hashtags', 'visual_direction'];
const clean = value => String(value ?? '').trim();
const dayKey = () => new Date().toISOString().slice(0, 10);

const outputSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    campaign_strategy: {type: 'string'},
    target_audience_angle: {type: 'string'},
    headlines: {type: 'array', items: {type: 'string'}},
    main_promotional_copy: {type: 'string'},
    flyer_ready_text: {type: 'string'},
    whatsapp_message: {type: 'string'},
    instagram_caption: {type: 'string'},
    facebook_post: {type: 'string'},
    x_post: {type: 'string'},
    call_to_actions: {type: 'array', items: {type: 'string'}},
    hashtags: {type: 'array', items: {type: 'string'}},
    visual_direction: {type: 'string'}
  },
  required: outputKeys
};

function promptFor(input) {
  return `Create a practical promotional campaign package for CREOVATE Promo Studio. Be specific, concise, culturally appropriate for the stated audience and location, and do not invent facts, guarantees, testimonials, discounts, prices, contacts or claims. Return only the requested structured fields.\n\nBusiness input:\n${JSON.stringify(input, null, 2)}`;
}

function parseJsonText(text, provider) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error(`The ${provider} provider returned no campaign result.`);
  const result = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim());
  if (!result || typeof result !== 'object' || outputKeys.some(key => !(key in result))) throw new Error('The AI response did not match the campaign schema.');
  return result;
}

function parseOpenAIOutput(body) {
  const fallback = Array.isArray(body?.output) ? body.output.flatMap(item => item.content || []).map(item => item.text || '').join('') : '';
  return parseJsonText(body?.output_text || fallback, 'OpenAI');
}

function parseGeminiOutput(body) {
  const text = Array.isArray(body?.candidates?.[0]?.content?.parts) ? body.candidates[0].content.parts.map(part => part.text || '').join('') : '';
  return parseJsonText(text, 'Gemini');
}

function providerUsage(body, env, provider) {
  const usage = body?.usage || {};
  const isGemini = provider === 'gemini';
  const inputTokens = Number(isGemini ? (usage.promptTokenCount || 0) : (usage.input_tokens || 0));
  const outputTokens = Number(isGemini ? (usage.candidatesTokenCount || 0) : (usage.output_tokens || 0));
  const inputRate = Number(env[`${provider.toUpperCase()}_INPUT_USD_PER_MILLION`] || 0);
  const outputRate = Number(env[`${provider.toUpperCase()}_OUTPUT_USD_PER_MILLION`] || 0);
  const estimatedCost = inputRate || outputRate ? ((inputTokens / 1e6) * inputRate) + ((outputTokens / 1e6) * outputRate) : null;
  return {provider, input_tokens: inputTokens, output_tokens: outputTokens, total_tokens: Number(isGemini ? (usage.totalTokenCount || inputTokens + outputTokens) : (usage.total_tokens || inputTokens + outputTokens)), estimated_cost_usd: estimatedCost};
}

async function createOpenAICampaign({brief, env}) {
  if (!env.OPENAI_API_KEY || !env.OPENAI_MODEL) throw new Error('The OpenAI provider is not configured yet.');
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {authorization: `Bearer ${env.OPENAI_API_KEY}`, 'content-type': 'application/json'},
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      input: [{role: 'system', content: [{type: 'input_text', text: 'You are the CREOVATE Promo Studio copy strategist.'}]}, {role: 'user', content: [{type: 'input_text', text: promptFor(brief)}]}],
      text: {format: {type: 'json_schema', name: 'creovate_promo_campaign', strict: true, schema: outputSchema}},
      max_output_tokens: 2200
    })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error?.message || `OpenAI returned ${response.status}.`);
    error.providerStatus = response.status;
    throw error;
  }
  return {result: parseOpenAIOutput(body), usage: providerUsage(body, env, 'openai')};
}

async function createGeminiCampaign({brief, env}) {
  if (!env.GEMINI_API_KEY || !env.GEMINI_MODEL) throw new Error('The Gemini provider is not configured yet.');
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent`, {
    method: 'POST',
    headers: {'x-goog-api-key': env.GEMINI_API_KEY, 'content-type': 'application/json'},
    body: JSON.stringify({
      contents: [{role: 'user', parts: [{text: `You are the CREOVATE Promo Studio copy strategist.\n\n${promptFor(brief)}`}]}],
      generationConfig: {responseMimeType: 'application/json', responseJsonSchema: outputSchema, temperature: 0.7, maxOutputTokens: 2200}
    })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error?.message || body.promptFeedback?.blockReason || `Gemini returned ${response.status}.`);
    error.providerStatus = response.status;
    throw error;
  }
  return {result: parseGeminiOutput(body), usage: providerUsage({usage: body.usageMetadata}, env, 'gemini')};
}

async function createCampaign({brief, env}) {
  const provider = String(env.AI_PROVIDER || 'gemini').toLowerCase();
  if (provider === 'gemini') return createGeminiCampaign({brief, env});
  if (provider === 'openai') return createOpenAICampaign({brief, env});
  throw new Error(`The configured AI provider is not supported: ${provider}.`);
}

async function claimOrder({env, orderId, user, jobId}) {
  const snapshot = await firestoreAdminGetWithMeta({env, collection: 'orders', documentId: orderId});
  const order = snapshot?.data;
  if (!order || order.user_id !== user.uid) throw new Error('That order is not available in this account.');
  if (order.order_type !== 'tool' || order.product_slug !== PRODUCT) throw new Error('That order is not a Promo Studio order.');
  if (order.payment_status !== 'paid') throw new Error('Payment is still being verified. No generation has started.');
  if (order.generation_status === 'completed' && order.generation_job_id) {
    const completed = await firestoreAdminGet({env, collection: 'generation_jobs', documentId: order.generation_job_id});
    return {order, jobId: order.generation_job_id, brief: completed?.brief || order.brief, existing: completed};
  }
  if (order.generation_status === 'processing') throw new Error('This paid generation is already being processed.');
  const entitlementSnapshot = await firestoreAdminGetWithMeta({env, collection: 'entitlements', documentId: orderId});
  const entitlement = entitlementSnapshot?.data;
  if (!entitlement || entitlement.user_id !== user.uid || entitlement.product_slug !== PRODUCT || entitlement.order_id !== orderId || entitlement.status !== 'available') {
    throw new Error('The verified Promo Studio entitlement is not ready yet. Wait for payment verification and try again.');
  }
  const updated = {...order, generation_status: 'processing', generation_job_id: jobId, generation_started_at: new Date().toISOString()};
  await firestoreAdminWrite({env, collection: 'orders', documentId: orderId, fields: updated, currentDocument: {updateTime: snapshot.updateTime}});
  const processingEntitlement = {...entitlement, status: 'processing', job_id: jobId, processing_started_at: new Date().toISOString()};
  await firestoreAdminWrite({env, collection: 'entitlements', documentId: orderId, fields: processingEntitlement, currentDocument: {updateTime: entitlementSnapshot.updateTime}});
  return {order: updated, jobId, brief: order.brief, entitlement: processingEntitlement};
}

async function claimRegeneration({env, jobId, user, newJobId}) {
  const snapshot = await firestoreAdminGetWithMeta({env, collection: 'generation_jobs', documentId: jobId});
  const job = snapshot?.data;
  if (!job || job.user_id !== user.uid || job.product !== PRODUCT) throw new Error('That campaign is not available in this account.');
  if (job.status !== 'completed') throw new Error('Only a completed campaign can be regenerated.');
  if (job.regeneration_used) throw new Error('The included free regeneration has already been used.');
  const order = await firestoreAdminGet({env, collection: 'orders', documentId: job.order_id});
  if (!order || order.user_id !== user.uid || order.order_type !== 'tool' || order.product_slug !== PRODUCT || order.payment_status !== 'paid') {
    throw new Error('A verified Promo Studio payment is required for regeneration.');
  }
  const updated = {...job, regeneration_used: true, regeneration_job_id: newJobId, updated_at: new Date().toISOString()};
  await firestoreAdminWrite({env, collection: 'generation_jobs', documentId: jobId, fields: updated, currentDocument: {updateTime: snapshot.updateTime}});
  return {original: updated, brief: job.brief, orderId: job.order_id};
}

async function reserveDailyUsage({env, userId}) {
  const limit = Math.max(1, Number(env.AI_DAILY_LIMIT || 5));
  const usageId = `${userId}_${dayKey()}`;
  const snapshot = await firestoreAdminGetWithMeta({env, collection: 'generation_usage', documentId: usageId});
  const usage = snapshot?.data || {user_id: userId, day: dayKey(), count: 0};
  if (Number(usage.count || 0) >= limit) throw new Error(`Your daily Promo Studio limit of ${limit} generations has been reached. Try again tomorrow.`);
  const reserved = {...usage, count: Number(usage.count || 0) + 1, updated_at: new Date().toISOString()};
  await firestoreAdminWrite({env, collection: 'generation_usage', documentId: usageId, fields: reserved, currentDocument: snapshot ? {updateTime: snapshot.updateTime} : {exists: false}});
  return {usageId, reserved};
}

export async function onRequestPost({request, env}) {
  if (env.PROMO_STUDIO_ENABLED !== 'true' || env.GENERATION_PAUSED !== 'false' || env.PAYMENTS_READY !== 'true') {
    return json({error: 'Promo Studio generation is not enabled yet. No payment was taken. The owner must finish provider, payment, and safety checks first.'}, 503);
  }
  let jobId = null;
  let usageReservation;
  let claimed;
  let originalJobId = null;
  let isRegeneration = false;
  try {
    const user = await firebaseUser(request, env);
    if (!user) return json({error: 'Sign in before using Promo Studio.'}, 401);
    const input = await request.json().catch(() => ({}));
    jobId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    isRegeneration = input.action === 'regenerate';

    if (isRegeneration) {
      originalJobId = clean(input.job_id);
      if (!originalJobId) return json({error: 'Choose a saved campaign to regenerate.'}, 400);
      claimed = await claimRegeneration({env, jobId: originalJobId, user, newJobId: jobId});
    } else {
      const orderId = clean(input.order_id);
      if (!orderId) return json({error: 'A verified Promo Studio order is required.'}, 400);
      claimed = await claimOrder({env, orderId, user, jobId});
      if (claimed.existing?.status === 'completed') return json({job_id: claimed.jobId, product: PRODUCT, status: 'completed', result: claimed.existing.result, existing: true});
    }

    usageReservation = await reserveDailyUsage({env, userId: user.uid});
    const brief = Object.fromEntries(fields.map(key => [key, clean(claimed.brief?.[key])]));
    const required = ['business_name', 'business_category', 'offer', 'campaign_category', 'target_audience', 'selling_point', 'objective', 'tone', 'platforms'];
    if (required.some(key => !brief[key])) throw new Error('The saved Promo Studio brief is incomplete.');
    if (Object.values(brief).some(value => value.length > 600)) throw new Error('One or more saved fields are too long.');

    await firestoreAdminWrite({env, collection: 'generation_jobs', documentId: jobId, fields: {id: jobId, order_id: claimed.orderId || claimed.order?.id, user_id: user.uid, product: PRODUCT, status: 'processing', generation_attempt: isRegeneration ? 2 : 1, created_at: createdAt, brief}});
    const generated = await createCampaign({brief, env});
    const completedAt = new Date().toISOString();
    const completedJob = {id: jobId, order_id: claimed.orderId || claimed.order?.id, user_id: user.uid, product: PRODUCT, status: 'completed', generation_attempt: isRegeneration ? 2 : 1, created_at: createdAt, completed_at: completedAt, brief, result: generated.result, usage: generated.usage, regeneration_used: false};
    await firestoreAdminWrite({env, collection: 'generation_jobs', documentId: jobId, fields: completedJob});
    if (isRegeneration) {
      await firestoreAdminWrite({env, collection: 'generation_jobs', documentId: originalJobId, fields: {regeneration_used: true, regeneration_job_id: jobId, updated_at: completedAt}});
    } else {
      await firestoreAdminWrite({env, collection: 'entitlements', documentId: claimed.order.id, fields: {...claimed.entitlement, status: 'consumed', consumed_at: completedAt, job_id: jobId, updated_at: completedAt}});
      await firestoreAdminWrite({env, collection: 'orders', documentId: claimed.order.id, fields: {...claimed.order, generation_status: 'completed', generated_at: completedAt, generation_job_id: jobId}});
    }
    return json({job_id: jobId, product: PRODUCT, status: 'completed', result: generated.result, usage: generated.usage});
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Promo Studio failed.';
    try {
      if (usageReservation?.usageId) {
        const current = await firestoreAdminGet({env, collection: 'generation_usage', documentId: usageReservation.usageId});
        if (current) await firestoreAdminWrite({env, collection: 'generation_usage', documentId: usageReservation.usageId, fields: {...current, count: Math.max(0, Number(current.count || 1) - 1), updated_at: new Date().toISOString()}});
      }
      if (jobId && (claimed?.order || claimed?.original)) await firestoreAdminWrite({env, collection: 'generation_jobs', documentId: jobId, fields: {id: jobId, order_id: claimed?.orderId || claimed?.order?.id, user_id: claimed?.order?.user_id || claimed?.original?.user_id, product: PRODUCT, status: 'failed', created_at: new Date().toISOString(), failed_at: new Date().toISOString(), error: message.slice(0, 300)}});
      if (isRegeneration && originalJobId && claimed?.original) await firestoreAdminWrite({env, collection: 'generation_jobs', documentId: originalJobId, fields: {regeneration_used: false, regeneration_job_id: null, updated_at: new Date().toISOString()}});
      if (!isRegeneration && claimed?.entitlement) {
        const entitlementSnapshot = await firestoreAdminGetWithMeta({env, collection: 'entitlements', documentId: claimed.order.id});
        if (['processing', 'consumed'].includes(entitlementSnapshot?.data?.status) && entitlementSnapshot.data.job_id === jobId) {
          await firestoreAdminWrite({env, collection: 'entitlements', documentId: claimed.order.id, fields: {...entitlementSnapshot.data, status: 'available', job_id: null, processing_started_at: null, updated_at: new Date().toISOString()}, currentDocument: {updateTime: entitlementSnapshot.updateTime}});
        }
      }
      if (!isRegeneration && claimed?.order?.id) await firestoreAdminWrite({env, collection: 'orders', documentId: claimed.order.id, fields: {...claimed.order, generation_status: 'failed', generation_error: message.slice(0, 300), updated_at: new Date().toISOString()}});
    } catch {}
    const providerStatus = Number(error?.providerStatus || 0);
    const status = providerStatus === 429 || /quota|rate limit|resource exhausted|too many requests|429/i.test(message) ? 429 : providerStatus === 503 || /not configured|configuration/i.test(message) ? 503 : /already|still being|not available|required|limit|incomplete|too long|regeneration/i.test(message) ? 409 : 502;
    return json({error: message}, status);
  }
}
