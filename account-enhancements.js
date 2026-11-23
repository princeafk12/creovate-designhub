(async () => {
  const auth = window.CREOVATE_AUTH;
  const user = await auth.requireUser();
  if (!user) return;

  const db = auth.client();
  const escape = auth.escapeHtml;
  const email = document.querySelector('#account-email');
  const ordersBox = document.querySelector('#orders-list');
  const promoBox = document.querySelector('#promo-results-list');
  const checksBox = document.querySelector('#account-validator-checks');

  if (email) email.textContent = `Signed in as ${user.email}`;

  const formatDate = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString('en-NG');
  };
  const formatMoney = value => `₦${Number(value || 0).toLocaleString('en-NG')}`;
  const renderAnalysis = analysis => {
    if (!analysis || typeof analysis !== 'object') return '';
    const sections = [
      ['Business summary', analysis.business_summary], ['Market demand', analysis.market_demand],
      ['Target audience', analysis.target_audience], ['Competition and differentiation', analysis.competition],
      ['Revenue model', analysis.revenue_model], ['Financial projections', analysis.financial_projections],
      ['Setup requirements', analysis.setup_requirements], ['SWOT analysis', analysis.swot],
      ['Risk assessment', analysis.risk_assessment], ['Validation experiments', analysis.validation_experiments],
      ['Marketing strategy', analysis.marketing_strategy], ['30-day action plan', analysis.action_plan_30_days],
      ['First-customer strategy', analysis.first_customer_strategy], ['Unknowns', analysis.unknowns],
      ['Recommendation', analysis.recommendation]
    ];
    const flatten = value => {
      if (value === null || value === undefined || value === '') return [];
      if (Array.isArray(value)) return value.flatMap(item => flatten(item));
      if (typeof value === 'object') return Object.entries(value).flatMap(([key, item]) => flatten(item).map(line => `${key.replace(/[_-]+/g, ' ')}: ${line}`));
      return [String(value)];
    };
    return sections.map(([title, value]) => { const items = flatten(value); return items.length ? `<section><strong>${escape(title)}</strong>${items.length === 1 ? `<p>${escape(items[0])}</p>` : `<ul>${items.map(item => `<li>${escape(item)}</li>`).join('')}</ul>`}</section>` : ''; }).join('');
  };
  const renderSavedCheck = check => {
    const report = String(check.result?.report || '').trim();
    const sources = Array.isArray(check.result?.sources) ? check.result.sources : [];
    const input = check.result?.input || {};
    const sourceList = sources.map(source => {
      const url = /^https?:\/\//i.test(source.url || '') ? source.url : '#';
      return `<li><a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(source.title || source.url || 'Source')}</a><small>${escape(source.url || '')} · accessed ${escape(source.accessed_at || check.result?.generated_at || '')}</small></li>`;
    }).join('');
    if (!report && !sources.length) return '';
    return `<details class="validator-history-details"><summary>Open saved report and sources</summary><div class="validator-history-report">${input.stage ? `<p><strong>Stage:</strong> ${escape(input.stage)}</p>` : ''}${input.skills ? `<p><strong>Skills:</strong> ${escape(input.skills)}</p>` : ''}${input.resources ? `<p><strong>Resources:</strong> ${escape(input.resources)}</p>` : ''}${check.result?.analysis ? `<div class="validator-history-analysis"><p><strong>Overall score:</strong> ${escape(check.result.analysis.overall_viability?.score ?? check.score ?? 'Not scored')}/100</p>${renderAnalysis(check.result.analysis)}</div>` : report ? `<div>${escape(report).replace(/\n/g, '<br>')}</div>` : '<p>Report text was not stored.</p>'}</div>${sourceList ? `<div class="validator-history-sources"><strong>Sources and dates</strong><ol>${sourceList}</ol></div>` : ''}</details>`;
  };
  const renderPromoResult = job => {
    const labels = {campaign_strategy: 'Campaign strategy', target_audience_angle: 'Target audience angle', headlines: 'Headline options', main_promotional_copy: 'Main promotional copy', flyer_ready_text: 'Flyer-ready text', whatsapp_message: 'WhatsApp message', instagram_caption: 'Instagram caption', facebook_post: 'Facebook post', x_post: 'X post', call_to_actions: 'Call-to-action suggestions', hashtags: 'Hashtags', visual_direction: 'Visual direction'};
    const result = job.result || {};
    const renderValue = value => Array.isArray(value) ? `<ul>${value.map(item => `<li>${escape(item)}</li>`).join('')}</ul>` : `<p>${escape(value).replace(/\n/g, '<br>')}</p>`;
    const sections = Object.entries(labels).filter(([key]) => result[key]).map(([key, label]) => `<section><strong>${label}</strong>${renderValue(result[key])}</section>`).join('');
    const actions = job.status === 'completed' ? `<div class="promo-actions"><button class="button button-outline-dark" type="button" data-copy-promo="${escape(job.id || '')}">Copy</button><button class="button button-outline-dark" type="button" data-download-promo="${escape(job.id || '')}">Download</button>${job.order_id ? (job.regeneration_used ? '<span class="form-note">Free regeneration used</span>' : `<button class="button button-outline-dark" type="button" data-regenerate-promo="${escape(job.id || '')}">Use free regeneration</button>`) : ''}</div>` : '';
    return `<article class="order-card promo-history-card"><strong>Promo Studio campaign</strong><span>${escape(job.status || 'saved')}</span><small>${formatDate(job.completed_at || job.created_at)} · Attempt ${escape(job.generation_attempt || 1)}</small>${actions}<details class="validator-history-details"><summary>Open campaign package</summary><div class="validator-history-report">${sections || '<p>No campaign result was stored.</p>'}</div></details><span hidden data-promo-json="${escape(job.id || '')}">${escape(JSON.stringify(result))}</span></article>`;
  };

  // The explicit user_id filters are defense in depth. Supabase RLS remains the
  // authoritative boundary and also permits the owner-only admin view.
  const loadChecks = async () => {
    const extended = await db.from('validator_checks')
      .select('idea,score,verdict,provider,created_at,result')
      .eq('user_id', user.id)
      .order('created_at', {ascending: false})
      .limit(25);
    if (!extended.error || !/column .* does not exist/i.test(extended.error.message || '')) return extended;
    return db.from('validator_checks')
      .select('idea,score,verdict,created_at')
      .eq('user_id', user.id)
      .order('created_at', {ascending: false})
      .limit(25);
  };
  const [{data: orders, error: ordersError}, {data: checks, error: checksError}, {data: promoJobs, error: promoError}] = await Promise.all([
    db.from('orders')
      .select('service_name,price,rush,status,payment_status,created_at,brief')
      .eq('user_id', user.id)
      .order('created_at', {ascending: false}),
    loadChecks(),
    db.from('generation_jobs')
      .select('id,order_id,product,status,created_at,completed_at,result,generation_attempt,regeneration_used')
      .eq('user_id', user.id)
      .eq('product', 'promo_studio')
      .order('created_at', {ascending: false})
      .limit(25)
  ]);

  if (ordersBox) {
    if (ordersError) {
      ordersBox.innerHTML = `<p class="form-status is-error">${escape(ordersError.message)}</p>`;
    } else if (!orders?.length) {
      ordersBox.innerHTML = '<p>No saved briefs yet. Your next brief will appear here after you send it.</p>';
    } else {
      ordersBox.innerHTML = orders.map(order => `<article class="order-card">
        <strong>${escape(order.service_name)}</strong>
        <span>${formatMoney(order.price)}${order.rush ? ' · Rush' : ''}</span>
        <small>${formatDate(order.created_at)} · ${escape(order.status || 'new')} · Payment: ${escape(order.payment_status || 'pending')}</small>
        ${order.brief?.name ? `<small>Brief: ${escape(order.brief.name)}</small>` : ''}
      </article>`).join('');
    }
  }

  if (promoBox) {
    if (promoError) {
      promoBox.innerHTML = `<p class="form-status is-error">${escape(promoError.message)}</p>`;
    } else if (!promoJobs?.length) {
      promoBox.innerHTML = '<p>No Promo Studio campaigns yet.</p>';
    } else {
      promoBox.innerHTML = promoJobs.map(renderPromoResult).join('');
    }
  }

  promoBox?.addEventListener('click', async event => {
    const download = event.target.closest('[data-download-promo]');
    const copy = event.target.closest('[data-copy-promo]');
    const regenerate = event.target.closest('[data-regenerate-promo]');
    if (!download && !copy && !regenerate) return;
    const jobId = (download || copy || regenerate).dataset.downloadPromo || (download || copy || regenerate).dataset.copyPromo || (download || copy || regenerate).dataset.regeneratePromo;
    const jsonNode = promoBox.querySelector(`[data-promo-json="${CSS.escape(jobId)}"]`);
    let result = {};
    try { result = JSON.parse(jsonNode?.textContent || '{}'); } catch {}
    if (copy) {
      await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
      copy.textContent = 'Copied';
      return;
    }
    if (download) {
      const blob = new Blob([JSON.stringify(result, null, 2)], {type: 'application/json'});
      const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'creovate-promo-studio-campaign.json'; link.click(); URL.revokeObjectURL(link.href);
      return;
    }
    const session = (await db.auth.getSession()).data.session;
    if (!session) return;
    regenerate.disabled = true;
    regenerate.textContent = 'Regenerating…';
    const response = await fetch('/api/generate-promo', {method: 'POST', headers: {'content-type': 'application/json', authorization: `Bearer ${session.access_token}`}, body: JSON.stringify({action: 'regenerate', job_id: jobId})});
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { regenerate.disabled = false; regenerate.textContent = body.error || 'Regenerate'; return; }
    window.location.reload();
  });

  if (checksBox) {
    if (checksError) {
      checksBox.innerHTML = `<p class="form-status is-error">${escape(checksError.message)}</p>`;
    } else if (!checks?.length) {
      checksBox.innerHTML = '<p>No validator checks yet.</p>';
    } else {
      checksBox.innerHTML = checks.map(check => {
        const sourceCount = Array.isArray(check.result?.sources) ? check.result.sources.length : 0;
        return `<article class="order-card">
          <strong>${escape(check.verdict || 'Validator report')}</strong>
          <span>${escape(check.provider || 'Live source report')}${sourceCount ? ` · ${sourceCount} sources` : ''}</span>
          <small>${formatDate(check.created_at)} · ${escape(check.idea)}</small>
          ${renderSavedCheck(check)}
        </article>`;
      }).join('');
    }
  }
})();
