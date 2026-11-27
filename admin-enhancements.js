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
  const adminAiTools = new Map();
  const adminAiProductNames = {caption_studio: 'Caption Studio', content_planner: '30-Day Content Planner', business_growth_kit: 'Business Growth Kit'};
  const adminAiProduct = document.querySelector('#admin-ai-test-product');
  const adminAiFields = document.querySelector('#admin-ai-test-fields');
  const adminAiHistory = document.querySelector('#admin-ai-test-history');
  const renderAdminAiResult = (run, saved = false) => {
    const name = adminAiProductNames[run.product] || adminAiProductNames[adminAiProduct?.value] || 'AI tool';
    const result = run.result && typeof run.result === 'object' ? `<details class="admin-ai-result-details"><summary>${saved ? 'Open saved result' : 'View generated result'}</summary><pre class="admin-ai-result">${escape(JSON.stringify(run.result, null, 2))}</pre></details>` : '';
    return `<article class="order-card"><strong>${escape(name)} · ${escape(run.status || 'completed')}</strong><small>${formatDate(run.completed_at || run.created_at)}${run.usage ? ` · ${escape(run.usage.provider)} · ${Number(run.usage.total_tokens || 0).toLocaleString('en-NG')} tokens` : ''}</small>${run.usage?.estimated_cost_usd != null ? `<small>Estimated provider cost: $${Number(run.usage.estimated_cost_usd).toFixed(4)}</small>` : ''}${result}${run.error ? `<p class="form-status is-error">${escape(run.error)}</p>` : ''}</article>`;
  };
  const renderAdminAiFields = product => {
    if (!adminAiFields) return;
    if (!product) { adminAiFields.innerHTML = ''; return; }
    adminAiFields.innerHTML = product.fields.map(field => {
      const id = `admin-ai-field-${field.key}`;
      const required = field.required ? ' required' : '';
      const maxLength = ` maxlength="${Number(field.maxLength) || 500}"`;
      let control = '';
      if (field.type === 'select') {
        control = `<select id="${escape(id)}" name="${escape(field.key)}"${required}><option value="">Choose an option</option>${(field.options || []).map(option => `<option value="${escape(option)}">${escape(option)}</option>`).join('')}</select>`;
      } else if (field.type === 'textarea') {
        control = `<textarea id="${escape(id)}" name="${escape(field.key)}" rows="3"${maxLength}${required}></textarea>`;
      } else {
        control = `<input id="${escape(id)}" name="${escape(field.key)}" type="text"${maxLength}${required}>`;
      }
      return `<label class="${field.type === 'textarea' ? 'form-field-full' : ''}" for="${escape(id)}">${escape(field.label)}${field.required ? ' *' : ''}${control}</label>`;
    }).join('');
  };
  const loadAdminAiHistory = async () => {
    if (!adminAiHistory) return;
    try {
      const {data: sessionData} = await db.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Your administrator session has expired.');
      const response = await fetch('/api/admin/test-tool', {headers: {authorization: `Bearer ${token}`}, cache: 'no-store'});
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Could not load saved test results.');
      adminAiHistory.innerHTML = body.runs?.length ? body.runs.map(run => renderAdminAiResult(run, true)).join('') : '<p>No admin AI tests saved yet.</p>';
    } catch (error) {
      adminAiHistory.innerHTML = `<p class="form-status is-error">${escape(error.message)}</p>`;
    }
  };
  if (adminAiProduct) {
    try {
      const response = await fetch('/api/tools/catalog', {cache: 'no-store'});
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Could not load the AI tools.');
      const allowed = new Set(Object.keys(adminAiProductNames));
      const products = (body.tools || []).filter(product => allowed.has(product.slug));
      products.forEach(product => adminAiTools.set(product.slug, product));
      adminAiProduct.innerHTML = '<option value="">Choose one tool</option>' + products.map(product => `<option value="${escape(product.slug)}">${escape(product.name)} · ₦${Number(product.price).toLocaleString('en-NG')}</option>`).join('');
      const submitButton = document.querySelector('#admin-ai-test-submit');
      if (submitButton) submitButton.disabled = products.length !== 3;
      if (products.length !== 3) setStatus('#admin-ai-test-status', 'The tool catalog did not return all three products. Refresh the admin page before testing.', true);
    } catch (error) {
      adminAiProduct.innerHTML = '<option value="">Tools could not be loaded</option>';
      setStatus('#admin-ai-test-status', error.message, true);
    }
    adminAiProduct.addEventListener('change', () => renderAdminAiFields(adminAiTools.get(adminAiProduct.value)));
    document.querySelector('#admin-ai-test-form')?.addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!form.reportValidity()) return;
      const button = document.querySelector('#admin-ai-test-submit');
      const product = adminAiProduct.value;
      const brief = Object.fromEntries([...adminAiFields.querySelectorAll('input,textarea,select')].map(field => [field.name, field.value]));
      button.disabled = true;
      setStatus('#admin-ai-test-status', 'Saving a private test record, then requesting the AI result. No checkout or payment will start.');
      document.querySelector('#admin-ai-test-result').innerHTML = '';
      try {
        const {data: sessionData} = await db.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error('Your administrator session has expired. Log in again.');
        const response = await fetch('/api/admin/test-tool', {method: 'POST', headers: {'content-type': 'application/json', authorization: `Bearer ${token}`}, body: JSON.stringify({product_slug: product, brief, adult_confirmed: document.querySelector('#admin-ai-test-age').checked})});
        const body = await response.json().catch(() => ({}));
        if (body.result) document.querySelector('#admin-ai-test-result').innerHTML = renderAdminAiResult({product, status: body.status, result: body.result, usage: body.usage, created_at: new Date().toISOString()});
        if (!response.ok) throw new Error(body.error || 'The admin AI test failed.');
        setStatus('#admin-ai-test-status', body.existing ? 'This tool was already tested today. Showing its saved result; no second AI request was made.' : 'Generated and saved. This result is private to the admin test log and was not added to a customer account.');
        await loadAdminAiHistory();
      } catch (error) {
        setStatus('#admin-ai-test-status', error.message, true);
        await loadAdminAiHistory();
      } finally {
        button.disabled = false;
      }
    });
    await loadAdminAiHistory();
  }
  const contentDefaults = {
    hero_title: 'Professional design, delivered in 24 hours.',
    hero_copy: 'Logos, flyers, social posts, business cards and full brand kits for businesses that want to look the part, at prices that make sense.',
    services_heading: 'Clear pricing. Useful deliverables.',
    services_intro: 'Naira prices. Full payment before work starts. Delivery by email or Google Drive, in PDF and PNG.',
    brief_heading: 'Tell us exactly what you want.',
    brief_intro: 'Fill in this short brief and it will open in WhatsApp as one clear message. Include the look, wording, colours and references you have in mind so we can understand the job before we reply.',
    validator_heading: 'Check your idea with current country data.',
    validator_intro: 'Free limited checks use public World Bank country indicators with Gemini analysis. They do not live-search competitors or confirm local laws, customer claims, or current prices; assumptions and evidence gaps are labelled.',
    portfolio_heading: 'See real designs in our full portfolio.',
    portfolio_intro: 'Browse logos, flyers, social posts and brand work in the CREOVATE portfolio.',
    footer_tagline: 'Premium design for businesses that want to look the part.',
    whatsapp_url: 'https://wa.me/2348084002972',
    portfolio_url: 'https://creovate-designhub.pages.dev/portfolio.html',
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

  const recentOrders = await db.from('orders').select('service_name,price,rush,status,payment_status,created_at,brief,order_type,product_slug').order('created_at', {ascending: false}).limit(25);
  renderOrders(document.querySelector('#admin-orders'), recentOrders.data, recentOrders.error);
  const recentPromoJobs = await db.from('generation_jobs').select('product,status,created_at,completed_at,usage,generation_attempt').order('created_at', {ascending: false}).limit(50);
  const recentChecks = await loadChecks();
  const paidOrders = (recentOrders.data || []).filter(order => order.payment_status === 'paid');
  const toolJobs = recentPromoJobs.data || [];
  const totalRevenue = paidOrders.reduce((sum, order) => sum + Number(order.price || 0), 0);
  const completedJobs = toolJobs.filter(job => job.status === 'completed');
  const failedJobs = toolJobs.filter(job => job.status === 'failed');
  const totalTokens = completedJobs.reduce((sum, job) => sum + Number(job.usage?.total_tokens || 0), 0);
  const validatorChecks = recentChecks.data || [];
  const validatorTokens = validatorChecks.reduce((sum, check) => sum + Number(check.result?.usage?.totalTokenCount || check.result?.usage?.total_tokens || 0), 0);
  const estimatedCost = completedJobs.reduce((sum, job) => sum + Number(job.usage?.estimated_cost_usd || 0), 0);
  const summary = document.querySelector('#admin-business-summary');
  if (summary) summary.innerHTML = [
    ['Recent paid revenue', formatMoney(totalRevenue)],
    ['Paid orders', String(paidOrders.length)],
    ['Tool generations completed', String(completedJobs.length)],
    ['Tool generations failed', String(failedJobs.length)],
    ['Recorded tokens', totalTokens.toLocaleString('en-NG')],
    ['Validator reports / tokens', `${validatorChecks.length} / ${validatorTokens.toLocaleString('en-NG')}`],
    ['Estimated AI cost', estimatedCost ? `$${estimatedCost.toFixed(4)}` : 'Not configured']
  ].map(([label, value]) => `<div class="admin-summary-card"><span>${escape(label)}</span><strong>${escape(value)}</strong></div>`).join('');
  const promoJobsBox = document.querySelector('#admin-promo-jobs');
  const productNames = {promo_studio:'Promo Studio',caption_studio:'Caption Studio',content_planner:'30-Day Content Planner',business_growth_kit:'Business Growth Kit'};
  if (promoJobsBox) promoJobsBox.innerHTML = recentPromoJobs.error ? `<p class="form-status is-error">${escape(recentPromoJobs.error.message)}</p>` : toolJobs.length ? toolJobs.map(job => `<article class="order-card"><strong>${escape(productNames[job.product] || 'CREOVATE for Business')}</strong><span>${escape(job.status || 'unknown')}</span><small>${formatDate(job.completed_at || job.created_at)} · Attempt ${escape(job.generation_attempt || 1)} · ${escape(String(job.usage?.total_tokens || 0))} tokens</small></article>`).join('') : '<p>No CREOVATE for Business generations yet.</p>';
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
    if (!userId) { setStatus('#password-status', 'Choose a customer account first.', true); return; }
    setStatus('#password-status', 'Sending the customer a secure reset link…');
    try {
      const {data: sessionData} = await db.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Your administrator session has expired. Log in again.');
      const response = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: {'content-type': 'application/json', authorization: `Bearer ${token}`},
        body: JSON.stringify({user_id: userId})
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Password reset failed.');
      setStatus('#password-status', body.message || 'The reset email was sent.');
    } catch (error) {
      setStatus('#password-status', error.message, true);
    }
  });

  const portfolioForm = document.querySelector('#portfolio-upload-form');
  const portfolioList = document.querySelector('#portfolio-admin-list');
  const portfolioFirestore = window.firebase?.firestore ? window.firebase.firestore() : null;
  const portfolioId = () => typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const portfolioPlaceholder = 'portfolio/placeholder.svg';
  const loadPortfolioImage = async (imageId, imageNode) => {
    if (!imageId || !imageNode || imageNode.dataset.loaded === 'true') return;
    imageNode.dataset.loaded = 'true';
    try {
      const snapshot = await portfolioFirestore.collection('portfolio_images').doc(imageId).get();
      const image = snapshot.data()?.data_url;
      if (image) imageNode.src = image;
    } catch {
      imageNode.dataset.loaded = 'false';
    }
  };
  const renderPortfolioItems = async snapshot => {
    if (!portfolioList) return;
    const items = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
    portfolioList.innerHTML = items.length ? items.map(item => `<article class="portfolio-admin-item"><img src="${escape(item.image_url || portfolioPlaceholder)}" data-admin-image-id="${escape(item.image_id || '')}" alt=""><div><strong>${escape(item.title)}</strong><span>${escape(item.category || 'Other')}</span><small>${item.published ? 'Published' : 'Hidden'} · ${escape(formatDate(item.created_at))}</small></div></article>`).join('') : '<p>No uploaded portfolio pieces yet.</p>';
    const images = [...portfolioList.querySelectorAll('img[data-admin-image-id]')].filter(image => image.dataset.adminImageId);
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        loadPortfolioImage(entry.target.dataset.adminImageId, entry.target);
      }), {rootMargin: '160px'});
      images.forEach(image => observer.observe(image));
    } else {
      await Promise.all(images.map(image => loadPortfolioImage(image.dataset.adminImageId, image)));
    }
  };
  const loadPortfolioItems = async () => {
    if (!portfolioList || !portfolioFirestore) return;
    portfolioList.innerHTML = '<p>Loading uploaded portfolio pieces…</p>';
    try {
      const snapshot = await portfolioFirestore.collection('portfolio_items').orderBy('created_at', 'desc').limit(50).get();
      await renderPortfolioItems(snapshot);
    } catch (error) {
      portfolioList.innerHTML = `<p class="form-status is-error">${escape(error.message || 'Could not load portfolio pieces.')}</p>`;
    }
  };
  portfolioForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const title = document.querySelector('#portfolio-title')?.value.trim() || '';
    const category = document.querySelector('#portfolio-category')?.value || 'Other';
    const file = document.querySelector('#portfolio-image')?.files?.[0];
    if (!portfolioFirestore) { setStatus('#portfolio-upload-status', 'Portfolio database is not available. Refresh the page and sign in again.', true); return; }
    if (!title || !file) { setStatus('#portfolio-upload-status', 'Add a title and choose an image first.', true); return; }
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) { setStatus('#portfolio-upload-status', 'Use a JPG, PNG or WebP image.', true); return; }
    if (file.size > 10 * 1024 * 1024) { setStatus('#portfolio-upload-status', 'That image is larger than 10 MB. Choose a smaller file.', true); return; }
    const id = portfolioId();
    const submitButton = portfolioForm.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    setStatus('#portfolio-upload-status', 'Compressing the image for the portfolio…');
    try {
      if (!window.createImageBitmap) throw new Error('This browser cannot compress the image. Try the latest Chrome or Edge.');
      const bitmap = await createImageBitmap(file);
      let width = Math.min(bitmap.width, 1800);
      let height = Math.round(bitmap.height * (width / bitmap.width));
      let blob;
      for (let attempt = 0; attempt < 9; attempt++) {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width));
        canvas.height = Math.max(1, Math.round(height));
        const context = canvas.getContext('2d', {alpha: true});
        if (!context) throw new Error('Could not prepare this image in the browser.');
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', Math.max(.5, .84 - attempt * .05)));
        if (blob && blob.size <= 600 * 1024) break;
        width *= .82;
        height *= .82;
      }
      bitmap.close?.();
      if (!blob || blob.size > 600 * 1024) throw new Error('This image is too detailed to fit the free database limit after compression. Choose a smaller image.');
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Could not read the compressed image.'));
        reader.readAsDataURL(blob);
      });
      if (dataUrl.length > 850_000) throw new Error('The compressed image is still too large. Choose a smaller image.');
      setStatus('#portfolio-upload-status', 'Saving and publishing…');
      const createdAt = new Date().toISOString();
      const itemRef = portfolioFirestore.collection('portfolio_items').doc(id);
      const imageRef = portfolioFirestore.collection('portfolio_images').doc(id);
      await portfolioFirestore.runTransaction(async transaction => {
        transaction.set(imageRef, {data_url: dataUrl, content_type: blob.type || 'image/webp', created_at: createdAt});
        transaction.set(itemRef, {id, title, category, image_id: id, published: true, created_at: createdAt});
      });
      portfolioForm.reset();
      setStatus('#portfolio-upload-status', 'Published. Refresh the portfolio page to see it.');
      await loadPortfolioItems();
    } catch (error) {
      setStatus('#portfolio-upload-status', error.message || 'Portfolio upload failed.', true);
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
  loadPortfolioItems();
})();
