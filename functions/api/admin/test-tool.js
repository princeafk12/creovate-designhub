import {firebaseUser, firestoreAdminCreate, firestoreAdminGet, firestoreAdminGetWithMeta, firestoreAdminWrite, json} from '../../_lib/firebase.js';
import {BUSINESS_TOOLS, toolBrief} from '../../_lib/business-tools.js';
import {ageConfirmationReceived, geminiRegionAllowed} from '../../_lib/ai-access.js';
import {generate} from '../generate-tool.js';

const OWNER_EMAIL = 'olanitealabij2023@gmail.com';
const ALLOWED_TOOLS = new Set(['caption_studio', 'content_planner', 'business_growth_kit']);

async function authorize(request, env) {
  const user = await firebaseUser(request, env);
  if (!user) return {response: json({error: 'Sign in with the owner account to use admin AI tests.'}, 401)};
  if (user.email !== OWNER_EMAIL) return {response: json({error: 'Owner administrator access is required.'}, 403)};
  const profile = await firestoreAdminGet({env, collection: 'profiles', documentId: user.uid});
  if (profile?.role !== 'admin' || String(profile.email || '').toLowerCase() !== OWNER_EMAIL) {
    return {response: json({error: 'Owner administrator access is required.'}, 403)};
  }
  return {user};
}

export async function onRequestGet({request, env}) {
  try {
    const access = await authorize(request, env);
    if (access.response) return access.response;
    const day = new Date().toISOString().slice(0, 10);
    const runs = await Promise.all([...ALLOWED_TOOLS].map(slug => firestoreAdminGet({env, collection: 'admin_tool_tests', documentId: `${access.user.uid}_${slug}_${day}`})));
    return json({runs: runs.filter(Boolean)});
  } catch {
    return json({error: 'Could not load the private admin test history.'}, 503);
  }
}

export async function onRequestPost({request, env}) {
  if (env.AI_TOOLS_ENABLED !== 'true') return json({error: 'AI tools are temporarily unavailable.'}, 503);
  let testId = '';
  let recordCreated = false;
  let attemptNumber = 0;
  try {
    const access = await authorize(request, env);
    if (access.response) return access.response;
    const {user} = access;
    const input = await request.json().catch(() => ({}));
    const slug = String(input.product_slug || '');
    if (!ALLOWED_TOOLS.has(slug) || !BUSINESS_TOOLS[slug]) return json({error: 'Choose one of the three supported AI tools.'}, 400);
    if (!ageConfirmationReceived(input.adult_confirmed)) return json({error: 'Confirm that you are 18 or older before using this AI test.'}, 400);
    if (env.PROMO_STUDIO_ENABLED !== 'true' || env.GENERATION_PAUSED !== 'false') return json({error: 'AI generation is paused in Production. No AI request was sent.'}, 503);

    const provider = String(env.AI_PROVIDER || 'gemini').toLowerCase();
    if (provider === 'gemini' && !geminiRegionAllowed(request)) return json({error: 'Gemini generation is not available in this region.'}, 403);
    if (provider === 'openai' && env.AI_PAID_PROVIDER_ENABLED !== 'true') return json({error: 'The configured paid AI provider is disabled.'}, 503);
    if (!['gemini', 'openai'].includes(provider)) return json({error: 'The configured AI provider is not supported.'}, 503);
    if (provider === 'gemini' && (!env.GEMINI_API_KEY || !env.GEMINI_MODEL)) return json({error: 'Gemini is not configured. No AI request was sent.'}, 503);
    if (provider === 'openai' && (!env.OPENAI_API_KEY || !env.OPENAI_MODEL)) return json({error: 'The configured AI provider is missing its key or model. No AI request was sent.'}, 503);

    const brief = toolBrief(slug, input.brief);
    const product = BUSINESS_TOOLS[slug];
    const day = new Date().toISOString().slice(0, 10);
    testId = `${user.uid}_${slug}_${day}`;
    const now = new Date().toISOString();
    const created = await firestoreAdminCreate({env, collection: 'admin_tool_tests', documentId: testId, fields: {id: testId, user_id: user.uid, product: slug, status: 'processing', attempts: 1, created_at: now, brief}});
    if (!created.created) {
      const priorSnapshot = await firestoreAdminGetWithMeta({env, collection: 'admin_tool_tests', documentId: testId});
      const prior = priorSnapshot?.data;
      if (prior?.status === 'completed') return json({test_id: testId, status: 'completed', result: prior.result, usage: prior.usage, existing: true});
      if (prior?.status === 'failed') {
        const attempts = Number(prior.attempts || 1);
        if (attempts >= 3) return json({error: `The three test attempts for this tool are used today. Last error: ${prior.error || 'AI generation failed.'} Try again tomorrow.`, status: 'failed'}, 409);
        attemptNumber = attempts + 1;
        await firestoreAdminWrite({env, collection: 'admin_tool_tests', documentId: testId, fields: {status: 'processing', attempts: attemptNumber, created_at: now, brief, error: ''}, currentDocument: {updateTime: priorSnapshot.updateTime}});
        recordCreated = true;
      } else {
        return json({error: 'This tool already has a test running today.'}, 409);
      }
    } else {
      attemptNumber = 1;
      recordCreated = true;
    }

    const generated = await generate({product, brief, env});
    const completedAt = new Date().toISOString();
    await firestoreAdminWrite({env, collection: 'admin_tool_tests', documentId: testId, fields: {status: 'completed', completed_at: completedAt, result: generated.result, usage: generated.usage}});
    return json({test_id: testId, product: slug, status: 'completed', result: generated.result, usage: generated.usage});
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The admin AI test failed.';
    if (recordCreated && testId) {
      try { await firestoreAdminWrite({env, collection: 'admin_tool_tests', documentId: testId, fields: {status: 'failed', failed_at: new Date().toISOString(), error: message.slice(0, 300)}}); } catch {}
    }
    const providerStatus = Number(error?.providerStatus || 0);
    const status = providerStatus === 429 || /quota|rate limit|resource exhausted|429/i.test(message) ? 429 : /not configured|configuration|service-account|Firebase server authorization/i.test(message) ? 503 : /complete these required|choose a valid option/i.test(message) ? 400 : recordCreated ? 502 : 503;
    const retryNote = attemptNumber < 3 ? `You can retry this tool today; attempt ${attemptNumber} of 3 was used.` : 'All 3 tries for this tool are used today.';
    return json({error: recordCreated ? `${message} ${retryNote}` : `${message} No AI request was sent.`}, status);
  }
}
