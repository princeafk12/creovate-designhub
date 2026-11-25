import {firebaseUser, firestoreAdminCreate, firestoreAdminGet, firestoreAdminGetWithMeta, firestoreAdminWrite, json} from '../_lib/firebase.js';
import {BUSINESS_TOOLS, toolBrief, validateToolResult} from '../_lib/business-tools.js';

const dayKey = () => new Date().toISOString().slice(0, 10);
const clean = value => String(value ?? '').trim().slice(0, 180);

function promptFor(product, brief) {
  return `${product.prompt}\nReturn only valid JSON matching this schema: ${JSON.stringify(product.schema)}\n\nCustomer brief:\n${JSON.stringify(brief, null, 2)}`;
}

function parseOutput(text, provider) {
  const raw = String(text || '').trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  if (!raw) throw new Error(`${provider} returned no result.`);
  return JSON.parse(raw);
}

function usageFor(body, env, provider) {
  const usage = provider === 'gemini' ? body?.usageMetadata || {} : body?.usage || {};
  const input = Number(provider === 'gemini' ? usage.promptTokenCount || 0 : usage.input_tokens || 0);
  const output = Number(provider === 'gemini' ? usage.candidatesTokenCount || 0 : usage.output_tokens || 0);
  const prefix = provider.toUpperCase();
  const inputRate = Number(env[`${prefix}_INPUT_USD_PER_MILLION`] || 0);
  const outputRate = Number(env[`${prefix}_OUTPUT_USD_PER_MILLION`] || 0);
  return {provider, input_tokens: input, output_tokens: output, total_tokens: Number(provider === 'gemini' ? usage.totalTokenCount || input + output : usage.total_tokens || input + output), estimated_cost_usd: inputRate || outputRate ? input / 1e6 * inputRate + output / 1e6 * outputRate : null};
}

async function generate({product, brief, env}) {
  const prompt = promptFor(product, brief);
  const provider = String(env.AI_PROVIDER || 'gemini').toLowerCase();
  let response;
  if (provider === 'gemini') {
    if (!env.GEMINI_API_KEY || !env.GEMINI_MODEL) throw new Error('Gemini is not configured.');
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(env.GEMINI_MODEL)}:generateContent`, {
      method: 'POST', headers: {'x-goog-api-key': env.GEMINI_API_KEY, 'content-type': 'application/json'},
      body: JSON.stringify({contents: [{role: 'user', parts: [{text: `You are CREOVATE's ${product.name} assistant. Do not add facts that were not supplied.\n${prompt}`}]}], generationConfig: {responseMimeType: 'application/json', responseJsonSchema: product.schema, temperature: 0.5, maxOutputTokens: product.maxOutputTokens}})
    });
  } else if (provider === 'openai') {
    if (!env.OPENAI_API_KEY || !env.OPENAI_MODEL) throw new Error('OpenAI is not configured.');
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST', headers: {authorization: `Bearer ${env.OPENAI_API_KEY}`, 'content-type': 'application/json'},
      body: JSON.stringify({model: env.OPENAI_MODEL, input: [{role: 'system', content: [{type: 'input_text', text: `You are CREOVATE's ${product.name} assistant.`}]}, {role: 'user', content: [{type: 'input_text', text: prompt}]}], text: {format: {type: 'json_schema', name: `creovate_${product.slug}`, strict: true, schema: product.schema}}, max_output_tokens: product.maxOutputTokens})
    });
  } else throw new Error(`Unsupported AI provider: ${provider}.`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error?.message || body.promptFeedback?.blockReason || `${provider} returned ${response.status}.`);
    error.providerStatus = response.status;
    throw error;
  }
  const output = provider === 'gemini'
    ? (body.candidates?.[0]?.content?.parts || []).map(part => part.text || '').join('')
    : body.output_text || (body.output || []).flatMap(item => item.content || []).map(item => item.text || '').join('');
  return {result: validateToolResult(product.slug, parseOutput(output, provider)), usage: usageFor(body, env, provider)};
}

async function reserveOne(env, id, fields, limit, label) {
  const snapshot = await firestoreAdminGetWithMeta({env, collection: 'generation_usage', documentId: id});
  const current = snapshot?.data || {...fields, count: 0};
  if (Number(current.count || 0) >= limit) throw new Error(`${label} has reached today's free-use limit. Try again tomorrow.`);
  await firestoreAdminWrite({env, collection: 'generation_usage', documentId: id, fields: {...current, count: Number(current.count || 0) + 1, updated_at: new Date().toISOString()}, currentDocument: snapshot ? {updateTime: snapshot.updateTime} : {exists: false}});
  return id;
}

async function reserveUsage(env, userId) {
  const day = dayKey();
  const globalId = `all_${day}`;
  const userUsageId = `${userId}_${day}`;
  const globalLimit = Math.max(1, Math.min(20, Number(env.AI_GLOBAL_DAILY_LIMIT || 10)));
  const userLimit = Math.max(1, Math.min(20, Number(env.AI_DAILY_LIMIT || 5)));
  await reserveOne(env, globalId, {day, usage_type: 'all-tools'}, globalLimit, 'The site-wide Business Tools AI limit');
  try {
    await reserveOne(env, userUsageId, {user_id: userId, day}, userLimit, 'Your daily AI generation limit');
  } catch (error) {
    await releaseUsage(env, globalId);
    throw error;
  }
  return {globalId, userUsageId};
}

async function releaseUsage(env, id) {
  try {
    const snapshot = await firestoreAdminGetWithMeta({env, collection: 'generation_usage', documentId: id});
    if (snapshot?.data) await firestoreAdminWrite({env, collection: 'generation_usage', documentId: id, fields: {...snapshot.data, count: Math.max(0, Number(snapshot.data.count || 1) - 1), updated_at: new Date().toISOString()}, currentDocument: {updateTime: snapshot.updateTime}});
  } catch {}
}

async function claimOrder(env, user, orderId, jobId) {
  const snapshot = await firestoreAdminGetWithMeta({env, collection: 'orders', documentId: orderId});
  const order = snapshot?.data;
  if (!order || order.user_id !== user.uid) throw new Error('That order is not available in this account.');
  const product = BUSINESS_TOOLS[order.product_slug];
  if (order.order_type !== 'tool' || !product) throw new Error('That order is not a supported business tool.');
  if (order.payment_status !== 'paid') throw new Error('Payment is still being verified. No generation has started.');
  if (Number(order.price) !== product.price || order.currency !== product.currency) throw new Error('The saved order price does not match this tool. Contact CREOVATE before retrying.');
  if (order.generation_status === 'completed' && order.generation_job_id) {
    const existing = await firestoreAdminGet({env, collection: 'generation_jobs', documentId: order.generation_job_id});
    if (existing?.status === 'completed') return {order, product, existing, jobId: existing.id};
  }
  if (order.generation_status === 'processing') throw new Error('This paid generation is already being processed.');
  const entitlementSnapshot = await firestoreAdminGetWithMeta({env, collection: 'entitlements', documentId: orderId});
  const entitlement = entitlementSnapshot?.data;
  if (!entitlement || entitlement.user_id !== user.uid || entitlement.product_slug !== product.slug || entitlement.order_id !== orderId || entitlement.status !== 'available') throw new Error('The verified generation entitlement is not ready. Wait for payment verification and try again.');
  const now = new Date().toISOString();
  const updatedOrder = {...order, generation_status: 'processing', generation_job_id: jobId, generation_started_at: now};
  await firestoreAdminWrite({env, collection: 'orders', documentId: orderId, fields: updatedOrder, currentDocument: {updateTime: snapshot.updateTime}});
  const updatedEntitlement = {...entitlement, status: 'processing', job_id: jobId, processing_started_at: now};
  await firestoreAdminWrite({env, collection: 'entitlements', documentId: orderId, fields: updatedEntitlement, currentDocument: {updateTime: entitlementSnapshot.updateTime}});
  return {order: updatedOrder, product, entitlement: updatedEntitlement, jobId, brief: order.brief};
}

async function claimRegeneration(env, user, jobId, nextJobId) {
  const snapshot = await firestoreAdminGetWithMeta({env, collection: 'generation_jobs', documentId: jobId});
  const job = snapshot?.data;
  const product = BUSINESS_TOOLS[job?.product];
  if (!job || job.user_id !== user.uid || !product) throw new Error('That saved generation is not available in this account.');
  if (job.status !== 'completed') throw new Error('Only a completed result can be regenerated.');
  if (job.regeneration_used) throw new Error('The included free regeneration has already been used.');
  const order = await firestoreAdminGet({env, collection: 'orders', documentId: job.order_id});
  if (!order || order.user_id !== user.uid || order.product_slug !== product.slug || order.payment_status !== 'paid') throw new Error('A verified payment is required for regeneration.');
  await firestoreAdminWrite({env, collection: 'generation_jobs', documentId: jobId, fields: {...job, regeneration_used: true, regeneration_job_id: nextJobId, updated_at: new Date().toISOString()}, currentDocument: {updateTime: snapshot.updateTime}});
  return {product, brief: job.brief, orderId: job.order_id, original: job};
}

export async function onRequestPost({request, env}) {
  if (env.PROMO_STUDIO_ENABLED !== 'true' || env.GENERATION_PAUSED !== 'false' || env.PAYMENTS_READY !== 'true') return json({error: 'Business tool generation is temporarily paused. No payment was taken.'}, 503);
  if (String(env.AI_PROVIDER || 'gemini').toLowerCase() === 'openai' && env.AI_PAID_PROVIDER_ENABLED !== 'true') return json({error: 'Business Tools are configured for the free Gemini provider. No generation has started.'}, 503);
  const user = await firebaseUser(request, env);
  if (!user) return json({error: 'Sign in before using Business Tools.'}, 401);
  let jobId;
  let usageReservation;
  let claimed;
  let originalJobId;
  let regeneration = false;
  try {
    const input = await request.json().catch(() => ({}));
    jobId = crypto.randomUUID();
    regeneration = input.action === 'regenerate';
    if (regeneration) {
      originalJobId = clean(input.job_id);
      if (!originalJobId) throw new Error('Choose a saved result to regenerate.');
      claimed = await claimRegeneration(env, user, originalJobId, jobId);
    } else {
      const orderId = clean(input.order_id);
      if (!orderId) throw new Error('A verified paid order is required.');
      claimed = await claimOrder(env, user, orderId, jobId);
      if (claimed.existing) return json({job_id: claimed.jobId, product: claimed.product.slug, status: 'completed', result: claimed.existing.result, existing: true});
    }
    const brief = toolBrief(claimed.product.slug, claimed.brief);
    usageReservation = await reserveUsage(env, user.uid);
    const now = new Date().toISOString();
    await firestoreAdminWrite({env, collection: 'generation_jobs', documentId: jobId, fields: {id: jobId, order_id: claimed.orderId || claimed.order?.id, user_id: user.uid, product: claimed.product.slug, status: 'processing', generation_attempt: regeneration ? 2 : 1, created_at: now, brief}});
    const generated = await generate({product: claimed.product, brief, env});
    const completedAt = new Date().toISOString();
    const completed = {id: jobId, order_id: claimed.orderId || claimed.order?.id, user_id: user.uid, product: claimed.product.slug, status: 'completed', generation_attempt: regeneration ? 2 : 1, created_at: now, completed_at: completedAt, brief, result: generated.result, usage: generated.usage, regeneration_used: false};
    await firestoreAdminWrite({env, collection: 'generation_jobs', documentId: jobId, fields: completed});
    if (regeneration) {
      await firestoreAdminWrite({env, collection: 'generation_jobs', documentId: originalJobId, fields: {regeneration_used: true, regeneration_job_id: jobId, updated_at: completedAt}});
    } else {
      await firestoreAdminWrite({env, collection: 'entitlements', documentId: claimed.order.id, fields: {...claimed.entitlement, status: 'consumed', consumed_at: completedAt, job_id: jobId, updated_at: completedAt}});
      await firestoreAdminWrite({env, collection: 'orders', documentId: claimed.order.id, fields: {...claimed.order, generation_status: 'completed', generated_at: completedAt, generation_job_id: jobId}});
    }
    return json({job_id: jobId, product: claimed.product.slug, status: 'completed', result: generated.result, usage: generated.usage});
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Generation failed.';
    if (usageReservation) await Promise.all([releaseUsage(env, usageReservation.globalId), releaseUsage(env, usageReservation.userUsageId)]);
    if (jobId && claimed) {
      const now = new Date().toISOString();
      try { await firestoreAdminWrite({env, collection: 'generation_jobs', documentId: jobId, fields: {id: jobId, order_id: claimed.orderId || claimed.order?.id, user_id: user.uid, product: claimed.product.slug, status: 'failed', created_at: now, failed_at: now, error: message.slice(0, 300)}}); } catch {}
      if (regeneration && originalJobId && claimed.original) {
        try { await firestoreAdminWrite({env, collection: 'generation_jobs', documentId: originalJobId, fields: {regeneration_used: false, regeneration_job_id: null, updated_at: now}}); } catch {}
      } else if (claimed.entitlement && claimed.order) {
        try {
          const snapshot = await firestoreAdminGetWithMeta({env, collection: 'entitlements', documentId: claimed.order.id});
          if (['processing', 'consumed'].includes(snapshot?.data?.status) && snapshot.data.job_id === jobId) await firestoreAdminWrite({env, collection: 'entitlements', documentId: claimed.order.id, fields: {...snapshot.data, status: 'available', job_id: null, processing_started_at: null, updated_at: now}, currentDocument: {updateTime: snapshot.updateTime}});
          await firestoreAdminWrite({env, collection: 'orders', documentId: claimed.order.id, fields: {...claimed.order, generation_status: 'failed', generation_error: message.slice(0, 300), updated_at: now}});
        } catch {}
      }
    }
    const providerStatus = Number(error?.providerStatus || 0);
    const status = providerStatus === 429 || /quota|rate limit|resource exhausted|429/i.test(message) ? 429 : /not configured|configuration/i.test(message) ? 503 : /already|still being|not available|required|limit|incomplete|too long|regeneration|match this tool/i.test(message) ? 409 : 502;
    return json({error: message}, status);
  }
}
