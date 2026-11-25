(async () => {
  const auth = window.CREOVATE_AUTH;
  const user = await auth.requireUser();
  if (!user) return;
  const db = auth.client();
  const escape = auth.escapeHtml;
  const email = document.querySelector('#account-email');
  const ordersBox = document.querySelector('#orders-list');
  const resultsBox = document.querySelector('#promo-results-list');
  const checksBox = document.querySelector('#account-validator-checks');
  if (email) email.textContent = `Signed in as ${user.email}`;
  const formatDate = value => { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString('en-NG'); };
  const formatMoney = value => `₦${Number(value || 0).toLocaleString('en-NG')}`;
  const label = key => String(key || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
  const renderValue = value => {
    if (Array.isArray(value)) return `<ul>${value.map(item => `<li>${renderValue(item)}</li>`).join('')}</ul>`;
    if (value && typeof value === 'object') return `<div class="saved-result-nested">${Object.entries(value).map(([key, item]) => `<section><strong>${escape(label(key))}</strong>${renderValue(item)}</section>`).join('')}</div>`;
    return `<p>${escape(value).replace(/\n/g, '<br>')}</p>`;
  };
  const renderAnalysis = analysis => {
    if (!analysis || typeof analysis !== 'object') return '';
    return Object.entries(analysis).map(([key, value]) => `<section><strong>${escape(label(key))}</strong>${renderValue(value)}</section>`).join('');
  };
  const renderSavedCheck = check => {
    const result = check.result || {};
    const sources = Array.isArray(result.sources) ? result.sources : [];
    const sourceList = sources.map(source => {
      const url = /^https?:\/\//i.test(source.url || '') ? source.url : '#';
      return `<li><a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(source.title || source.url || 'Source')}</a><small>${escape(source.url || '')} · ${escape(source.year ? `data year ${source.year}` : `accessed ${source.accessed_at || result.generated_at || ''}`)}</small></li>`;
    }).join('');
    const dataList = (result.indicators || []).map(item => `<li><strong>${escape(item.label)}:</strong> ${escape(Number(item.value).toLocaleString('en-US', {maximumFractionDigits: 2}))} · ${escape(item.year)}</li>`).join('');
    return `<details class="validator-history-details"><summary>Open saved report and sources</summary><div class="validator-history-report">${result.input ? `<p><strong>Brief:</strong> ${escape(result.input.idea || check.idea || '')}</p>` : ''}${result.analysis ? renderAnalysis(result.analysis) : result.report ? `<p>${escape(result.report)}</p>` : '<p>Report details were not stored.</p>'}${dataList ? `<section><strong>Country-level data used</strong><ul>${dataList}</ul></section>` : ''}${result.evidence_limitations ? `<p><strong>Evidence limits:</strong> ${escape(result.evidence_limitations)}</p>` : ''}</div>${sourceList ? `<div class="validator-history-sources"><strong>Sources and dates</strong><ol>${sourceList}</ol></div>` : ''}</details>`;
  };
  const toolNames = {promo_studio: 'Promo Studio', caption_studio: 'Caption Studio', content_planner: '30-Day Content Planner', business_growth_kit: 'Business Growth Kit'};
  const renderJob = job => {
    const result = job.result || {};
    const sections = Object.entries(result).map(([key, value]) => `<section><strong>${escape(label(key))}</strong>${renderValue(value)}</section>`).join('');
    const buttons = job.status === 'completed' ? `<div class="promo-actions"><button class="button button-outline-dark" type="button" data-action="copy" data-job-id="${escape(job.id)}">Copy</button><button class="button button-outline-dark" type="button" data-action="download" data-job-id="${escape(job.id)}">Download</button>${job.order_id ? job.regeneration_used ? '<span class="form-note">Free regeneration used</span>' : `<button class="button button-outline-dark" type="button" data-action="regenerate" data-job-id="${escape(job.id)}">Use free regeneration</button>` : ''}</div>` : job.status === 'failed' && job.order_id ? `<div class="promo-actions"><button class="button button-outline-dark" type="button" data-action="retry" data-order-id="${escape(job.order_id)}">Retry paid generation</button></div>` : '';
    return `<article class="order-card promo-history-card"><strong>${escape(toolNames[job.product] || 'Business Tool')}</strong><span>${escape(job.status || 'saved')}</span><small>${formatDate(job.completed_at || job.created_at)} · Attempt ${escape(job.generation_attempt || 1)}</small>${buttons}${job.status === 'completed' ? `<details class="validator-history-details"><summary>Open saved result</summary><div class="validator-history-report">${sections || '<p>No result was stored.</p>'}</div></details>` : job.status === 'failed' ? `<small>${escape(job.error || 'Generation did not complete. Retry when the AI service is available.')}</small>` : ''}<span hidden data-job-json="${escape(job.id)}">${escape(JSON.stringify(result))}</span></article>`;
  };

  const [{data: orders, error: ordersError}, {data: jobs, error: jobsError}, {data: checks, error: checksError}] = await Promise.all([
    db.from('orders').select('*').eq('user_id', user.id).order('created_at', {ascending: false}).limit(50),
    db.from('generation_jobs').select('*').eq('user_id', user.id).order('created_at', {ascending: false}).limit(50),
    db.from('validator_checks').select('*').eq('user_id', user.id).order('created_at', {ascending: false}).limit(25)
  ]);
  if (ordersBox) ordersBox.innerHTML = ordersError ? `<p class="form-status is-error">${escape(ordersError.message)}</p>` : !orders?.length ? '<p>No saved briefs or purchases yet. Your activity will appear here.</p>' : orders.map(order => `<article class="order-card"><strong>${escape(order.service_name || toolNames[order.product_slug] || 'CREOVATE order')}</strong><span>${formatMoney(order.price)}${order.rush ? ' · Rush' : ''}</span><small>${formatDate(order.created_at)} · ${escape(order.status || 'new')} · Payment: ${escape(order.payment_status || 'pending')}${order.generation_status ? ` · Generation: ${escape(order.generation_status)}` : ''}</small>${order.brief?.name ? `<small>Brief: ${escape(order.brief.name)}</small>` : ''}</article>`).join('');
  if (resultsBox) resultsBox.innerHTML = jobsError ? `<p class="form-status is-error">${escape(jobsError.message)}</p>` : !jobs?.length ? '<p>No saved Business Tool results yet.</p>' : jobs.map(renderJob).join('');
  resultsBox?.addEventListener('click', async event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const jobId = button.dataset.jobId;
    const action = button.dataset.action;
    if (action === 'copy' || action === 'download') {
      const node = resultsBox.querySelector(`[data-job-json="${CSS.escape(jobId)}"]`);
      const json = node?.textContent || '{}';
      if (action === 'copy') { await navigator.clipboard.writeText(json); button.textContent = 'Copied'; return; }
      const item = jobs.find(job => job.id === jobId);
      const blob = new Blob([json], {type: 'application/json'});
      const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `creovate-${(item?.product || 'business-tool').replaceAll('_', '-')}.json`; link.click(); URL.revokeObjectURL(link.href); return;
    }
    const session = (await db.auth.getSession()).data.session;
    if (!session) return;
    button.disabled = true; button.textContent = 'Regenerating…';
    const bodyInput = action === 'retry' ? {order_id: button.dataset.orderId} : {action: 'regenerate', job_id: jobId};
    const response = await fetch('/api/generate-tool', {method: 'POST', headers: {'content-type': 'application/json', authorization: `Bearer ${session.access_token}`}, body: JSON.stringify(bodyInput)});
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { button.disabled = false; button.textContent = body.error || (action === 'retry' ? 'Retry paid generation' : 'Regenerate'); return; }
    window.location.reload();
  });
  if (checksBox) checksBox.innerHTML = checksError ? `<p class="form-status is-error">${escape(checksError.message)}</p>` : !checks?.length ? '<p>No Validator checks yet.</p>' : checks.map(check => {
    const count = Array.isArray(check.result?.sources) ? check.result.sources.length : 0;
    return `<article class="order-card"><strong>${escape(check.verdict || 'Validator report')}</strong><span>${escape(check.provider || 'Free public-data Validator')}${count ? ` · ${count} sources` : ''}</span><small>${formatDate(check.created_at)} · ${escape(check.idea)}</small>${renderSavedCheck(check)}</article>`;
  }).join('');
})();
