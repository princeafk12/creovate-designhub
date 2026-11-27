(() => {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      toggle.setAttribute('aria-label', open ? 'Open website menu' : 'Close website menu');
      nav.classList.toggle('is-open', !open);
    });
    nav.addEventListener('click', event => {
      if (event.target.closest('a')) {
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Open website menu');
        nav.classList.remove('is-open');
      }
    });
    document.addEventListener('click', event => {
      if (!nav.contains(event.target) && !toggle.contains(event.target)) {
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Open website menu');
        nav.classList.remove('is-open');
      }
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Open website menu');
        nav.classList.remove('is-open');
      }
    });
  }
})();

(() => {
  const getSession = async () => {
    try {
      if (!window.CREOVATE_AUTH) return null;
      const {data} = await window.CREOVATE_AUTH.client().auth.getSession();
      return data.session || null;
    } catch (error) { return null; }
  };
  const client = () => window.CREOVATE_AUTH.client();
  const setup = async (form, gate, result) => {
    const session = await getSession();
    if (session) {
      form.hidden = false;
      gate.hidden = true;
    } else {
      form.hidden = true;
      if (result) result.hidden = true;
      gate.hidden = false;
    }
    return session;
  };
  window.CREOVATE_MEMBER = {getSession, client, setup};
})();

(() => {
  const form = document.querySelector('#brief-form');
  if (!form) return;
  const gate = document.querySelector('#brief-gate');
  const service = form.elements.namedItem('service');
  const rush = form.elements.namedItem('rush');
  const price = document.querySelector('#brief-price');
  const priceNote = document.querySelector('#brief-price-note');
  const rushOption = document.querySelector('#rush-option');
  const status = document.querySelector('#brief-status');
  const formatNaira = value => `₦${Number(value).toLocaleString('en-NG')}`;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[character]));
  const fallbackSettings = {launch_active: true, launch_spots_total: 15, launch_spots_remaining: 15, discount_percent: 30, rush_percent: 30, offer_message: ''};
  const applySiteContent = content => {
    const values = content && typeof content === 'object' ? content : {};
    document.querySelectorAll('[data-content-text]').forEach(element => {
      const value = values[element.dataset.contentText];
      if (typeof value === 'string' && value.trim()) element.textContent = value;
    });
    document.querySelectorAll('[data-content-url]').forEach(element => {
      const value = values[element.dataset.contentUrl];
      if (typeof value === 'string' && /^https?:\/\//i.test(value.trim())) element.href = value.trim();
    });
    const email = values.contact_email;
    document.querySelectorAll('[data-content-email]').forEach(element => {
      if (typeof email === 'string' && email.trim()) {
        element.href = `mailto:${email.trim()}`;
        element.textContent = email.trim();
      }
    });
  };
  let settings = {...fallbackSettings};
  const slugFor = name => ({'Logo design':'logo','Flyer / poster':'flyer','Social media post':'social-post','Social media pack':'social-pack','Business card':'business-card','Full brand kit':'brand-kit'}[name] || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
  const knownServiceSlugs = ['logo', 'flyer', 'social-post', 'social-pack', 'business-card', 'brand-kit'];
  document.querySelectorAll('.service-card').forEach((card, index) => { if (!card.dataset.serviceSlug && knownServiceSlugs[index]) card.dataset.serviceSlug = knownServiceSlugs[index]; });
  Array.from(service.options).filter(option => option.dataset.launch).forEach((option, index) => { if (!option.dataset.slug && knownServiceSlugs[index]) option.dataset.slug = knownServiceSlugs[index]; });
  let services = Array.from(service.options).filter(option => option.dataset.launch).map(option => ({slug: option.dataset.slug || slugFor(option.value), name: option.value, launch_price: Number(option.dataset.launch), standard_price: Number(option.dataset.standard), rush_enabled: option.dataset.rush === 'true', rush_percent: 30}));
  const activeLaunch = () => settings.launch_active && Number(settings.launch_spots_remaining) > 0;
  const selectedService = () => services.find(item => item.slug === (service.options[service.selectedIndex]?.dataset.slug || slugFor(service.value))) || null;

  const updateQuote = () => {
    const selected = selectedService();
    if (!selected) {
      price.textContent = 'Choose a service';
      priceNote.textContent = activeLaunch() ? `The first ${settings.launch_spots_total} bookings after launch receive the launch price.` : 'The launch offer has ended. Standard prices now apply.';
      rush.checked = false;
      rush.disabled = true;
      rushOption.classList.remove('is-available');
      return;
    }
    const launch = Number(selected.launch_price);
    const standard = Number(selected.standard_price);
    const rushAvailable = Boolean(selected.rush_enabled);
    const base = activeLaunch() ? launch : standard;
    rush.disabled = !rushAvailable;
    if (!rushAvailable) rush.checked = false;
    rushOption.classList.toggle('is-available', rushAvailable);
    const rushRate = Number(selected.rush_percent || settings.rush_percent);
    const current = rush.checked ? Math.round(base * (1 + rushRate / 100)) : base;
    price.textContent = formatNaira(current);
    priceNote.textContent = `${activeLaunch() ? `Launch price: ${formatNaira(launch)} for the first ${settings.launch_spots_remaining} remaining booking(s).` : `Standard price: ${formatNaira(standard)} after the launch offer.`}${rushAvailable ? ` Rush price: ${formatNaira(Math.round(base * (1 + rushRate / 100)))}.` : ''}`;
  };

  const applyPublicSettings = () => {
    document.querySelectorAll('.service-card').forEach(card => {
      const name = card.querySelector('h3')?.textContent.trim();
      const item = services.find(serviceItem => serviceItem.slug === card.dataset.serviceSlug || serviceItem.name === name);
      if (!item) return;
      card.dataset.serviceSlug = item.slug;
      const title = card.querySelector('h3');
      if (title) title.textContent = item.name;
      const priceElement = card.querySelector('.price');
      if (priceElement) priceElement.innerHTML = `${formatNaira(activeLaunch() ? item.launch_price : item.standard_price)} <del>${formatNaira(activeLaunch() ? item.standard_price : item.launch_price)}</del>`;
      const deliveryElement = card.querySelector('.meta');
      if (deliveryElement && item.delivery_time) deliveryElement.textContent = `Delivery: ${item.delivery_time}`;
      const descriptionElement = card.querySelector('.service-description') || card.children[3];
      if (descriptionElement && item.description) descriptionElement.textContent = item.description;
      const meta = card.querySelector('.meta');
      if (meta && item.delivery_time) meta.textContent = `Delivery: ${item.delivery_time}`;
    });
    Array.from(service.options).forEach(option => {
      const item = services.find(serviceItem => serviceItem.slug === option.dataset.slug || serviceItem.name === option.textContent.trim());
      if (!item) return;
      option.textContent = item.name;
      option.dataset.slug = item.slug;
      option.dataset.launch = item.launch_price;
      option.dataset.standard = item.standard_price;
      option.dataset.rush = item.rush_enabled;
    });
    const label = document.querySelector('#launch-label');
    const offer = document.querySelector('#offer-copy');
    if (label) label.textContent = activeLaunch() ? `Launch offer: first ${settings.launch_spots_total} bookings only` : 'Launch offer ended — standard prices now apply';
    if (offer) {
      const customOffer = String(settings.offer_message || '').trim();
      offer.textContent = customOffer || (activeLaunch() ? `${settings.discount_percent}% off every design service for the first ${settings.launch_spots_remaining} remaining booking(s) after launch. Standard prices apply after those bookings are taken.` : 'Launch offer ended. Standard prices now apply to all new bookings.');
    }
    updateQuote();
  };

  const loadPublicSettings = async () => {
    if (!window.CREOVATE_AUTH) return;
    try {
      const db = window.CREOVATE_AUTH.client();
      const [{data: settingsData}, {data: servicesData}] = await Promise.all([
        db.from('site_settings').select('*').eq('id', 1).maybeSingle(),
        db.from('services').select('*').order('name')
      ]);
      if (settingsData) settings = {...settings, ...settingsData};
      if (servicesData?.length) services = servicesData;
      applyPublicSettings();
      applySiteContent(settings.content || {});
    } catch (error) { /* Static fallback remains usable if the database is not configured yet. */ }
  };

  service.addEventListener('change', updateQuote);
  rush.addEventListener('change', updateQuote);
  const requestedService = new URLSearchParams(window.location.search).get('service');
  if (requestedService) {
    const requestedOption = Array.from(service.options).find(option => option.dataset.slug === requestedService);
    if (requestedOption) service.value = requestedOption.value;
  }
  updateQuote();

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const session = await window.CREOVATE_MEMBER.getSession();
    if (!session) { window.location.href = 'signup.html?next=brief.html'; return; }
    const data = new FormData(form);
    const selected = selectedService();
    if (!selected) return;
    const currentBase = activeLaunch() ? Number(selected.launch_price) : Number(selected.standard_price);
    const rushSelected = Boolean(data.get('rush')) && selected.rush_enabled;
    const rushRate = Number(selected.rush_percent || settings.rush_percent);
    const currentPrice = rushSelected ? Math.round(currentBase * (1 + rushRate / 100)) : currentBase;
    const lines = [
      'Hi CREOVATE - DesignHub, I want to send a design brief.', '',
      `Service: ${selected.name}`, `Name: ${data.get('name')}`, `Email: ${data.get('email')}`,
      `Business name: ${data.get('business')}`, `Brand name: ${data.get('brand')}`,
      `Price for this brief: ${formatNaira(currentPrice)}${rushSelected ? ' (rush)' : ''}`,
      `Standard price after launch: ${formatNaira(selected.standard_price)}`, `Deadline: ${data.get('deadline') || 'Not specified'}`,
      '', `About the business or brand:\n${data.get('description')}`, '', `How I want it to look:\n${data.get('direction')}`,
      '', `Words and details to include:\n${data.get('copy') || 'Not specified'}`, '', `Reference link(s): ${data.get('references') || 'None'}`
    ];
    const whatsappUrl = `https://wa.me/2348084002972?text=${encodeURIComponent(lines.join('\n'))}`;
    status.textContent = 'Opening WhatsApp and preparing secure checkout…';
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {'content-type': 'application/json', authorization: `Bearer ${session.access_token}`},
        body: JSON.stringify({service_slug: selected.slug, rush: rushSelected, brief: Object.fromEntries(data.entries())})
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.checkout_url) throw new Error(body.error || 'Secure checkout is not configured yet.');
      status.innerHTML = `Your brief was saved. <a href="${escape(body.checkout_url)}" target="_blank" rel="noopener noreferrer">Continue to Flutterwave payment</a>.`;
    } catch (error) {
      status.textContent = `WhatsApp opened. Secure payment is not ready yet: ${error.message}`;
    }
  });
  window.CREOVATE_MEMBER.setup(form, gate, status);
  loadPublicSettings();
})();
