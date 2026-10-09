(async () => {
  const auth = window.CREOVATE_AUTH;
  const access = await auth.requireAdmin();
  if (!access) return;

  const db = auth.client();
  const escape = auth.escapeHtml;
  const formatDate = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString('en-NG');
  };
  const formatMoney = value => `₦${Number(value || 0).toLocaleString('en-NG')}`;
  const setStatus = (selector, text, error = false) => {
    const node = document.querySelector(selector);
    if (!node) return;
    node.textContent = text;
    node.classList.toggle('is-error', error);
  };
  const contentDefaults = {
    hero_title: 'Professional design, delivered in 24 hours.',
    hero_copy: 'Logos, flyers, social posts, business cards and full brand kits for businesses that want to look the part, at prices that make sense.',
    services_heading: 'Clear pricing. Useful deliverables.',
    services_intro: 'Naira prices. Full payment before work starts. Delivery by email or Google Drive, in PDF and PNG.',
    brief_heading: 'Tell us exactly what you want.',
    brief_intro: 'Fill in this short brief and it will open in WhatsApp as one clear message. Include the look, wording, colours and references you have in mind so we can understand the job before we reply.',
    validator_heading: 'Validate → Plan → Execute.',
    validator_intro: 'Build a practical first view of demand, competition, money, setup requirements, risks and your next 30 days. Signed-in checks use current web information, show dated sources, and save the report only in your customer account.',
    portfolio_heading: 'See real designs in our full portfolio.',
    portfolio_intro: 'Browse logos, flyers, social posts and brand work in the CREOVATE Google Drive folder.',
    footer_tagline: 'Premium design for businesses that want to look the part.',
    whatsapp_url: 'https://wa.me/2348084002972',
    portfolio_url: 'https://drive.google.com/drive/folders/1Lfp6BQux8iWElEoBP7RST6SMnOsolIB3?usp=drive_link',
    facebook_url: 'https://web.facebook.com/creovatehq7',
    youtube_url: 'https://www.youtube.com/@creovatedigitalspace',
    x_url: 'https://x.com/creovate123',
    instagram_url: 'https://instagram.com/creovatehq',
    contact_email: 'olanitealabij2023@gmail.com'
  };

  const [{data: settings}, {data: services, error: servicesError}] = await Promise.all([
    db.from('site_settings').select('*').eq('id', 1).maybeSingle(),
    db.from('services').select('*').order('name')
  ]);
  if (settings) {
    document.querySelector('#launch-active').checked = Boolean(settings.launch_active);
    document.querySelector('#launch-total').value = settings.launch_spots_total;
    document.querySelector('#launch-remaining').value = settings.launch_spots_remaining;
    document.querySelector('#discount-percent').value = settings.discount_percent;
    document.querySelector('#rush-percent').value = settings.rush_percent;
    document.querySelector('#offer-message').value = settings.offer_message || '';
    const savedContent = settings.content && typeof settings.content === 'object' ? settings.content : {};
    document.querySelectorAll('[data-content-field]').forEach(field => {
      const key = field.dataset.contentField;
      field.value = savedContent[key] ?? contentDefaults[key] ?? '';
    });
  }
  const editor = document.querySelector('#services-editor');
  if (servicesError) {
    setStatus('#services-status', servicesError.message, true);
  } else if (editor) {
    editor.innerHTML = (services || []).map(item => `<fieldset class="service-editor" data-slug="${escape(item.slug)}"><legend>${escape(item.name)}</legend><label>Service name<input data-field="name" type="text" value="${escape(item.name)}" required></label><label>Launch price<input data-field="launch_price" type="number" min="0" value="${Number(item.launch_price)}"></label><label>Standard price<input data-field="standard_price" type="number" min="0" value="${Number(item.standard_price)}"></label><label>Delivery time<input data-field="delivery_time" type="text" value="${escape(item.delivery_time)}"></label><label class="check-row">Rush available<input data-field="rush_enabled" type="checkbox" ${item.rush_enabled ? 'checked' : ''}></label><label>Description<textarea data-field="description" rows="2">${escape(item.description)}</textarea></label></fieldset>`).join('');
  }

  document.querySelector('#settings-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const result = await db.from('site_settings').update({
      launch_active: document.querySelector('#launch-active').checked,
      launch_spots_total: Number(document.querySelector('#launch-total').value),
      launch_spots_remaining: Number(document.querySelector('#launch-remaining').value),
      discount_percent: Number(document.querySelector('#discount-percent').value),
      rush_percent: Number(document.querySelector('#rush-percent').value),
      offer_message: document.querySelector('#offer-message').value.trim(),
      updated_at: new Date().toISOString()
    }).eq('id', 1);
    setStatus('#settings-status', result.error ? result.error.message : 'Offer settings saved.', Boolean(result.error));
  });

  document.querySelector('#save-services')?.addEventListener('click', async () => {
    const updates = Array.from(document.querySelectorAll('.service-editor')).map(serviceEditor => {
      const read = field => serviceEditor.querySelector(`[data-field="${field}"]`);
      return db.from('services').update({
        name: read('name').value.trim(),
        launch_price: Number(read('launch_price').value),
        standard_price: Number(read('standard_price').value),
        delivery_time: read('delivery_time').value,
        rush_enabled: read('rush_enabled').checked,
        description: read('description').value,
        updated_at: new Date().toISOString()
      }).eq('slug', serviceEditor.dataset.slug);
    });
    const results = await Promise.all(updates);
    const error = results.find(result => result.error)?.error;
    setStatus('#services-status', error ? error.message : 'Service settings saved.', Boolean(error));
  });

  document.querySelector('#content-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const content = {};
    document.querySelectorAll('[data-content-field]').forEach(field => {
      content[field.dataset.contentField] = field.value.trim();
    });
    const result = await db.from('site_settings').update({content, updated_at: new Date().toISOString()}).eq('id', 1);
    setStatus('#content-status', result.error ? `${result.error.message} If content is missing, run phase-5-admin-content-password-migration.sql first.` : 'Website content saved. Refresh the public website to see it.', Boolean(result.error));
  });

  const renderOrders = (box, orders, error, emptyText = 'No saved orders yet.') => {
    if (!box) return;
    if (error) box.innerHTML = `<p class="form-status is-error">${escape(error.message)}</p>`;
    else if (!orders?.length) box.innerHTML = `<p>${emptyText}</p>`;
    else box.innerHTML = orders.map(order => `<article class="order-card"><strong>${escape(order.service_name)}</strong><span>${formatMoney(order.price)}${order.rush ? ' · Rush' : ''}</span><small>${formatDate(order.created_at)} · ${escape(order.status || 'new')} · Payment: ${escape(order.payment_status || 'pending')} · ${escape(order.brief?.name || '')}</small></article>`).join('');
  };
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
  const renderChecks = (box, checks, error) => {
    if (!box) return;
    if (error) box.innerHTML = `<p class="form-status is-error">${escape(error.message)}</p>`;
    else if (!checks?.length) box.innerHTML = '<p>No validator checks yet.</p>';
    else box.innerHTML = checks.map(check => `<article class="order-card"><strong>${escape(check.verdict || 'Validator report')}</strong><span>${escape(check.provider || 'Live source report')}${Array.isArray(check.result?.sources) && check.result.sources.length ? ` · ${check.result.sources.length} sources` : ''}</span><small>${formatDate(check.created_at)} · ${escape(check.idea)} · ${escape(check.audience)}</small>${renderSavedCheck(check)}</article>`).join('');
  };
  const loadChecks = async userId => {
    const build = columns => {
      let query = db.from('validator_checks').select(columns).order('created_at', {ascending: false}).limit(25);
      if (userId) query = query.eq('user_id', userId);
      return query;
    };
    const extended = await build('idea,audience,score,verdict,provider,created_at,result');
    if (!extended.error || !/column .* does not exist/i.test(extended.error.message || '')) return extended;
    return build('idea,audience,score,verdict,created_at');
  };

  const recentOrders = await db.from('orders').select('service_name,price,rush,status,payment_status,created_at,brief').order('created_at', {ascending: false}).limit(25);
  renderOrders(document.querySelector('#admin-orders'), recentOrders.data, recentOrders.error);
  const recentChecks = await loadChecks();
  renderChecks(document.querySelector('#admin-validator-checks'), recentChecks.data, recentChecks.error);

  const userSelect = document.querySelector('#admin-user-select');
  const passwordSelect = document.querySelector('#password-user-select');
  const userSummary = document.querySelector('#admin-user-summary');
  const userOrders = document.querySelector('#admin-user-orders');
  const userChecks = document.querySelector('#admin-user-checks');
  const {data: profiles, error: profilesError} = await db.from('profiles').select('id,email,created_at,role').order('created_at', {ascending: false});
  if (profilesError) {
    if (userSelect) userSelect.innerHTML = '<option value="">Could not load customer accounts</option>';
    if (passwordSelect) passwordSelect.innerHTML = '<option value="">Could not load customer accounts</option>';
    if (userSummary) userSummary.textContent = profilesError.message;
  } else {
    const profileOptions = (profiles || []).map(profile => `<option value="${escape(profile.id)}">${escape(profile.email || 'No email')} · joined ${escape(formatDate(profile.created_at))}</option>`).join('');
    if (userSelect) {
      userSelect.innerHTML = '<option value="">Choose a customer account</option>' + profileOptions;
      userSelect.addEventListener('change', async () => {
      const userId = userSelect.value;
      if (!userId) {
        userSummary.textContent = '';
        userOrders.innerHTML = '<p>Choose a customer to view their saved activity.</p>';
        userChecks.innerHTML = '';
        return;
      }
      const profile = profiles.find(item => item.id === userId);
      userSummary.textContent = `${profile?.email || 'Customer'} · account created ${formatDate(profile?.created_at)}${profile?.role === 'admin' ? ' · owner/admin account' : ''}`;
      userOrders.innerHTML = '<p>Loading this customer’s orders…</p>';
      userChecks.innerHTML = '<p>Loading this customer’s validator checks…</p>';
      const [orders, checks] = await Promise.all([
        db.from('orders').select('service_name,price,rush,status,payment_status,created_at,brief').eq('user_id', userId).order('created_at', {ascending: false}),
        loadChecks(userId)
      ]);
      renderOrders(userOrders, orders.data, orders.error, 'This customer has no saved orders.');
      renderChecks(userChecks, checks.data, checks.error);
      });
    }
    if (passwordSelect) {
      const customers = (profiles || []).filter(profile => profile.role !== 'admin');
      passwordSelect.innerHTML = '<option value="">Choose a customer account</option>' + customers.map(profile => `<option value="${escape(profile.id)}">${escape(profile.email || 'No email')} · joined ${escape(formatDate(profile.created_at))}</option>`).join('');
    }
  }

  document.querySelector('#user-password-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const userId = passwordSelect?.value;
    const newPassword = document.querySelector('#temporary-password')?.value || '';
    if (!userId) { setStatus('#password-status', 'Choose a customer account first.', true); return; }
    setStatus('#password-status', 'Updating the customer password…');
    try {
      const {data: sessionData} = await db.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Your administrator session has expired. Log in again.');
      const response = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: {'content-type': 'application/json', authorization: `Bearer ${token}`},
        body: JSON.stringify({user_id: userId, new_password: newPassword})
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Password reset failed.');
      setStatus('#password-status', body.message || 'Temporary password set. Give it to the customer privately.');
      document.querySelector('#temporary-password').value = '';
    } catch (error) {
      setStatus('#password-status', error.message, true);
    }
  });
})();
