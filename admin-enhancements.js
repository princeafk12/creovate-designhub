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
    editor.innerHTML = (services || []).map(item => `<fieldset class="service-editor" data-slug="${escape(item.slug)}"><legend>${escape(item.name)}</legend><label>Public price (NGN)<input data-field="launch_price" type="number" min="0" value="${Number(item.launch_price)}" required></label><label>Delivery time<input data-field="delivery_time" type="text" value="${escape(item.delivery_time)}"></label><label class="check-row">Rush available<input data-field="rush_enabled" type="checkbox" ${item.rush_enabled ? 'checked' : ''}></label><label>Description<textarea data-field="description" rows="2">${escape(item.description)}</textarea></label></fieldset>`).join('');
  }

  document.querySelector('#save-services')?.addEventListener('click', async () => {
    const updates = Array.from(document.querySelectorAll('.service-editor')).map(serviceEditor => {
      const read = field => serviceEditor.querySelector(`[data-field="${field}"]`);
      return db.from('services').update({
        name: read('name').value.trim(),
        launch_price: Number(read('launch_price').value),
        standard_price: Number(read('launch_price').value),
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
  let recentOrders = [];
  let monitoringError = null;
  try {
    const {data: sessionData} = await db.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error('Your administrator session has expired. Log in again.');
    const response = await fetch('/api/admin/monitoring', {headers: {authorization: 'Bearer ' + token}, cache: 'no-store'});
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Recent orders could not load.');
    recentOrders = body.orders || [];
  } catch (error) {
    monitoringError = error;
  }
  renderOrders(document.querySelector('#admin-orders'), recentOrders, monitoringError, 'No saved orders yet.');

    const userSelect = document.querySelector('#admin-user-select');
  const passwordSelect = document.querySelector('#password-user-select');
  const userSummary = document.querySelector('#admin-user-summary');
  const userOrders = document.querySelector('#admin-user-orders');
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
        return;
      }
      const profile = profiles.find(item => item.id === userId);
      userSummary.textContent = `${profile?.email || 'Customer'} · account created ${formatDate(profile?.created_at)}${profile?.role === 'admin' ? ' · owner/admin account' : ''}`;
      userOrders.innerHTML = '<p>Loading this customer’s orders…</p>';
      const orders = await db.from('orders').select('service_name,price,rush,status,payment_status,created_at,brief').eq('user_id', userId).order('created_at', {ascending: false});
      renderOrders(userOrders, orders.data, orders.error, 'This customer has no saved orders.');
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
