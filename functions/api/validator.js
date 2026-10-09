import {currentUser, json, supabaseRest} from '../_lib/supabase.js';

export async function onRequestPost({request, env}) {
  try {
    const user = await currentUser(request, env);
    if (!user) return json({error: 'Sign in before using the validator.'}, 401);
    if (!env.ANTHROPIC_API_KEY || !env.VALIDATOR_MODEL) return json({error: 'Live validator is not configured yet.'}, 503);
    const input = await request.json();
    const idea = limit(input.idea, 1200);
    const audience = limit(input.audience, 300);
    const location = limit(input.location, 200);
    const stage = limit(input.stage || 'idea', 100);
    const goal = limit(input.goal, 100);
    const budget = limit(input.budget, 100);
    const skills = limit(input.skills, 800);
    const resources = limit(input.resources, 800);
    if (!idea || !audience || !location || !goal || !budget) return json({error: 'Complete all validator fields.'}, 400);

    const maxDaily = Number(env.VALIDATOR_MAX_REPORTS_PER_USER_PER_DAY || 3);
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const recent = await supabaseRest(env, `validator_checks?user_id=eq.${encodeURIComponent(user.id)}&created_at=gte.${encodeURIComponent(startOfDay.toISOString())}&select=id`, {method: 'GET'});
    if ((recent.data || []).length >= maxDaily) return json({error: 'Your daily validator limit has been reached.'}, 429);

    const monthlyCap = Number(env.VALIDATOR_MONTHLY_SPEND_LIMIT_MINOR || 0);
    const estimatedCost = Number(env.VALIDATOR_ESTIMATED_COST_MINOR_PER_REPORT || 0);
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const usage = await supabaseRest(env, `validator_checks?created_at=gte.${encodeURIComponent(monthStart.toISOString())}&select=estimated_cost_minor`, {method: 'GET'});
    const used = (usage.data || []).reduce((sum, row) => sum + Number(row.estimated_cost_minor || 0), 0);
    if (!monthlyCap || used + estimatedCost > monthlyCap) return json({error: 'The validator is temporarily unavailable because its spending limit has been reached.'}, 429);

    const maxSearches = Math.max(1, Math.min(Number(env.VALIDATOR_MAX_SEARCHES_PER_REPORT || 5), 10));
    const brief = JSON.stringify({idea, audience, location, stage, goal, budget, skills, resources});
    const prompt = `Act as a careful business analyst, market researcher, financial evaluator and practical strategy adviser. Research the user's business idea for the stated location using current web sources. Do not invent competitor names, prices, statistics, regulations or demand. Distinguish live evidence from user-provided information, calculated estimates, recommendations and unknowns. Where a cost or revenue estimate is possible, show the assumption and currency. Consider local realities such as purchasing power, transport, electricity, logistics, payment methods and location-specific requirements when relevant. Cite every material current claim through the web-search citations. Return one valid JSON object only, with no Markdown fences and no commentary, using these keys: business_summary, overall_viability {score, label, confidence}, scores [{name, score, weight, reason}], market_demand, target_audience, competition, revenue_model, financial_projections, setup_requirements, swot, risk_assessment, validation_experiments, marketing_strategy, action_plan_30_days, first_customer_strategy, unknowns, recommendation. Include practical customer interview questions, a small MVP test, a test budget and measurable pass/fail criteria inside validation_experiments. The scoring weights are illustrative, not a guarantee; insufficient evidence should reduce confidence. End the recommendation with a clear disclaimer that this is not legal, tax, investment or professional advice. User brief: ${brief}`;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: env.VALIDATOR_MODEL,
        max_tokens: 4500,
        messages: [{role: 'user', content: prompt}],
        tools: [{type: 'web_search_20250305', name: 'web_search', max_uses: maxSearches}]
      })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return json({error: 'Live source retrieval failed. Try again later.'}, 502);
    const generatedAt = new Date().toISOString();
    const contentBlocks = Array.isArray(body.content) ? body.content : [];
    const textBlocks = contentBlocks.filter(block => block.type === 'text');
    const reportText = textBlocks.map(block => block.text || '').join('\n\n').trim();
    const sources = contentBlocks.flatMap(block => (block.citations || []).map(citation => ({
      url: citation.url,
      title: citation.title || citation.url,
      cited_text: citation.cited_text || '',
      accessed_at: generatedAt
    }))).filter(source => /^https?:\/\//i.test(source.url || ''));
    const uniqueSources = Array.from(new Map(sources.map(source => [source.url, source])).values());
    if (!reportText || !uniqueSources.length) return json({error: 'The validator did not return a source-backed report.'}, 502, {'cache-control': 'no-store'});
    const analysis = parseAnalysis(reportText);
    const scoreValue = Number(analysis?.overall_viability?.score ?? analysis?.score);
    const score = Number.isFinite(scoreValue) ? Math.max(0, Math.min(100, Math.round(scoreValue))) : 0;
    const verdict = limit(analysis?.overall_viability?.label || analysis?.recommendation || 'Source-backed report', 180);

    const insert = await supabaseRest(env, 'validator_checks', {
      method: 'POST', headers: {prefer: 'return=minimal'}, body: {
        user_id: user.id, idea, audience, location, goal, budget,
        score, verdict,
        provider: 'anthropic-web-search', search_count: maxSearches, estimated_cost_minor: estimatedCost,
        result: {report: reportText, analysis, sources: uniqueSources, generated_at: generatedAt, input: {stage, skills, resources}}
      }
    });
    if (!insert.response.ok) return json({error: 'The report was generated but could not be saved.'}, 500);
    return json({report: reportText, analysis, score, verdict, sources: uniqueSources, generated_at: generatedAt}, 200, {'cache-control': 'no-store'});
  } catch (error) {
    return json({error: error instanceof Error ? error.message : 'Validator failed.'}, 500);
  }
}

function limit(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

function parseAnalysis(text) {
  const fenced = String(text || '').match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  try { return JSON.parse(candidate); } catch (error) { /* Try the outermost object if the model added a prefix. */ }
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(candidate.slice(start, end + 1)); } catch (error) { return null; }
}
