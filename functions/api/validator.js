import {firebaseUser, firestoreAdminCreate, firestoreAdminGetWithMeta, firestoreAdminWrite, json} from '../_lib/firebase.js';
import {ageConfirmationReceived, geminiRegionAllowed} from '../_lib/ai-access.js';

const text = {type: 'string'};
const texts = {type: 'array', items: text};
const obj = properties => ({type: 'object', additionalProperties: false, properties, required: Object.keys(properties)});
const score = {type: 'integer', minimum: 0, maximum: 100};
const schema = obj({
  overall_viability: obj({score, label: text, confidence: text}),
  scores: {type: 'array', items: obj({name: text, score, reason: text})},
  business_summary: text, market_demand: texts, target_audience: texts, competition: texts,
  revenue_model: texts, financial_projections: texts, setup_requirements: texts,
  swot: obj({strengths: texts, weaknesses: texts, opportunities: texts, threats: texts}),
  risk_assessment: texts, validation_experiments: texts, marketing_strategy: texts,
  action_plan_30_days: texts, first_customer_strategy: texts, unknowns: texts, recommendation: text
});

const indicators = [
  {code: 'SP.POP.TOTL', label: 'Population'},
  {code: 'NY.GDP.PCAP.CD', label: 'GDP per capita (current US$)'},
  {code: 'IT.NET.USER.ZS', label: 'Individuals using the internet (% of population)'},
  {code: 'SP.URB.TOTL.IN.ZS', label: 'Urban population (% of total population)'},
  {code: 'FP.CPI.TOTL.ZG', label: 'Consumer price inflation (annual %)'}
];
const dayKey = () => new Date().toISOString().slice(0, 10);
const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

async function getJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(url, {headers: {accept: 'application/json'}, signal: controller.signal});
    const body = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(body) || !Array.isArray(body[1])) throw new Error(`Public country data is temporarily unavailable (${response.status || 'invalid response'}).`);
    return body[1];
  } finally { clearTimeout(timeout); }
}

async function countryFor(location) {
  const countriesUrl = 'https://api.worldbank.org/v2/country?format=json&per_page=400';
  const countries = await getJson(countriesUrl);
  const wanted = norm(location);
  const country = countries.find(item => item.region?.value !== 'Aggregates' && (norm(item.name) === wanted || norm(item.iso2Code) === wanted));
  if (!country || !country.iso2Code) throw new Error('Enter a country name recognised by the World Bank, for example Nigeria.');
  return {country, source: {title: 'World Bank country and income classification', url: countriesUrl, accessed_at: new Date().toISOString()}};
}

async function indicatorFor(countryCode, indicator) {
  const url = `https://api.worldbank.org/v2/country/${encodeURIComponent(countryCode)}/indicator/${encodeURIComponent(indicator.code)}?format=json&per_page=60`;
  const rows = await getJson(url);
  const row = rows.filter(item => item.value !== null && item.value !== undefined).sort((left, right) => Number(right.date) - Number(left.date))[0];
  if (!row) return null;
  return {label: indicator.label, value: Number(row.value), year: String(row.date), source: {title: `${indicator.label} — World Bank`, url, year: String(row.date), accessed_at: new Date().toISOString()}};
}

async function reserve(env, collection, id, limit, initial = {}) {
  const snapshot = await firestoreAdminGetWithMeta({env, collection, documentId: id});
  const current = snapshot?.data || {count: 0, day: dayKey(), ...initial};
  if (Number(current.count || 0) >= limit) throw new Error('You have used today’s Validator assessment. Please try again tomorrow.');
  const fields = {...current, count: Number(current.count || 0) + 1, updated_at: new Date().toISOString()};
  await firestoreAdminWrite({env, collection, documentId: id, fields, currentDocument: snapshot ? {updateTime: snapshot.updateTime} : {exists: false}});
  return id;
}

async function release(env, collection, id) {
  if (!id) return;
  try {
    const snapshot = await firestoreAdminGetWithMeta({env, collection, documentId: id});
    if (snapshot?.data) await firestoreAdminWrite({env, collection, documentId: id, fields: {...snapshot.data, count: Math.max(0, Number(snapshot.data.count || 1) - 1), updated_at: new Date().toISOString()}, currentDocument: {updateTime: snapshot.updateTime}});
  } catch {}
}

function validateAnalysis(value) {
  const check = (item, rule, path = 'analysis') => {
    if (rule.type === 'object') {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`The AI report was incomplete at ${path}.`);
      const keys = Object.keys(rule.properties || {});
      if ((rule.required || []).some(key => !(key in item)) || Object.keys(item).some(key => !keys.includes(key))) throw new Error(`The AI report schema did not match at ${path}.`);
      keys.forEach(key => check(item[key], rule.properties[key], `${path}.${key}`));
      return;
    }
    if (rule.type === 'array') {
      if (!Array.isArray(item) || item.length > 50) throw new Error(`The AI report contains an invalid list at ${path}.`);
      item.forEach((child, index) => check(child, rule.items, `${path}[${index}]`));
      return;
    }
    if (rule.type === 'string') {
      if (typeof item !== 'string' || item.length > 6000) throw new Error(`The AI report contains invalid text at ${path}.`);
      return;
    }
    if (rule.type === 'integer' && (!Number.isInteger(item) || item < rule.minimum || item > rule.maximum)) throw new Error(`The AI report contains an invalid score at ${path}.`);
  };
  try { check(value, schema); }
  catch (error) { throw new Error(`${error.message} Your assessment allowance has been restored.`); }
  return value;
}

async function generate({env, input, country, countrySource, indicatorsData}) {
  const model = env.GEMINI_MODEL;
  const prompt = `You are CREOVATE's business idea validator. Assess the supplied idea using only the customer brief and the public World Bank country indicators below. Do not claim that the indicators prove demand for this particular product. Do not invent competitors, competitor prices, market size, laws, permits, taxes, exact costs, growth rates, or customer behaviour. Explicitly separate national-level evidence from assumptions. Say when a current, local or sector-specific fact is unknown. Give practical low-cost experiments, avoid guarantees, and treat budgets as user-provided. Return every field in the schema.\n\nCustomer brief:\n${JSON.stringify(input, null, 2)}\n\nCountry: ${country.name} (${country.iso2Code})\nWorld Bank indicators (latest non-null values returned; dates may lag):\n${JSON.stringify(indicatorsData, null, 2)}`;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST', headers: {'x-goog-api-key': env.GEMINI_API_KEY, 'content-type': 'application/json'},
    body: JSON.stringify({contents: [{role: 'user', parts: [{text: prompt}]}], generationConfig: {responseMimeType: 'application/json', responseJsonSchema: schema, temperature: 0.2, maxOutputTokens: 3600}})
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error?.message || body.promptFeedback?.blockReason || `Gemini returned ${response.status}.`);
    error.providerStatus = response.status;
    throw error;
  }
  const output = (body.candidates?.[0]?.content?.parts || []).map(part => part.text || '').join('').trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  return {analysis: validateAnalysis(JSON.parse(output)), usage: body.usageMetadata || {}};
}

export async function onRequestPost({request, env}) {
  if (env.AI_TOOLS_ENABLED !== 'true') return json({error: 'AI tools are temporarily unavailable.'}, 503);
  if (env.VALIDATOR_PAUSED === 'true') return json({error: 'The Validator is temporarily paused.'}, 503);
  if (String(env.AI_PROVIDER || 'gemini').toLowerCase() !== 'gemini' || !env.GEMINI_API_KEY || !env.GEMINI_MODEL) return json({error: 'The Validator AI service is not configured.'}, 503);
  if (!geminiRegionAllowed(request)) return json({error: 'The Validator is not available in your current region with the configured Gemini service.'}, 403);
  const user = await firebaseUser(request, env);
  if (!user) return json({error: 'Sign in before using the Validator.'}, 401);
  const inputRaw = await request.json().catch(() => ({}));
  if (!ageConfirmationReceived(inputRaw.adult_confirmed)) return json({error: 'Confirm that you are 18 or older before using the Validator.'}, 400);
  const input = Object.fromEntries(['idea', 'audience', 'location', 'stage', 'goal', 'budget', 'skills', 'resources'].map(key => [key, String(inputRaw?.[key] || '').trim().slice(0, key === 'idea' ? 240 : 400)]));
  const required = ['idea', 'audience', 'location', 'stage', 'goal'];
  if (required.some(key => !input[key])) return json({error: 'Complete the business idea, customer, country, stage and goal fields.'}, 400);
  const limit = 1;
  const day = dayKey();
  const globalId = `all_${day}`;
  const aiUserId = `${user.uid}_${day}`;
  const userId = `${user.uid}_${day}`;
  let globalReservation;
  let aiUserReservation;
  let userReservation;
  try {
    const {country, source: countrySource} = await countryFor(input.location);
    const indicatorResults = await Promise.allSettled(indicators.map(item => indicatorFor(country.iso2Code, item)));
    const indicatorsData = indicatorResults.filter(item => item.status === 'fulfilled' && item.value).map(item => item.value);
    if (indicatorsData.length < 2) return json({error: 'The public World Bank data could not provide enough country indicators for a useful check. Try again later.'}, 503);
    const aiGlobalLimit = Math.max(1, Math.min(20, Number(env.AI_GLOBAL_DAILY_LIMIT || 10)));
    const aiUserLimit = Math.max(1, Math.min(20, Number(env.AI_DAILY_LIMIT || 5)));
    globalReservation = await reserve(env, 'generation_usage', globalId, aiGlobalLimit, {usage_type: 'all-tools-and-validator'});
    aiUserReservation = await reserve(env, 'generation_usage', aiUserId, aiUserLimit, {user_id: user.uid});
    userReservation = await reserve(env, 'validator_usage', userId, limit, {user_id: user.uid});
    const generated = await generate({env, input, country, countrySource, indicatorsData});
    const createdAt = new Date().toISOString();
    const sourceList = [countrySource, ...indicatorsData.map(item => item.source)];
    const report = {analysis: generated.analysis, input, country: {name: country.name, code: country.iso2Code}, indicators: indicatorsData, sources: sourceList, generated_at: createdAt, evidence_limitations: 'Country-level indicators are not proof of demand for a specific business and may be delayed. This Validator does not live-search competitors, verify customer claims, or check local laws, licences, taxes or prices. Validate these directly before investing.', usage: generated.usage};
    const id = crypto.randomUUID();
    const record = {id, user_id: user.uid, idea: input.idea, score: generated.analysis.overall_viability.score, verdict: generated.analysis.overall_viability.label, provider: 'Gemini + World Bank public indicators', adult_confirmed: true, created_at: createdAt, result: report};
    await firestoreAdminCreate({env, collection: 'validator_checks', documentId: id, fields: record});
    return json({...report, id, provider: record.provider});
  } catch (error) {
    await Promise.all([release(env, 'generation_usage', globalReservation), release(env, 'generation_usage', aiUserReservation), release(env, 'validator_usage', userReservation)]);
    const message = error instanceof Error ? error.message : 'The Validator could not finish.';
    const status = error?.providerStatus === 429 || /quota|rate limit|429/i.test(message) ? 429 : /not recognised/i.test(message) ? 400 : /not configured/i.test(message) ? 503 : /limit has been reached/i.test(message) ? 429 : 502;
    return json({error: message}, status);
  }
}
