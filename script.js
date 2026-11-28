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
  const setup = (form, gate) => {
    form.hidden = false;
    if (gate) gate.hidden = true;
  };
  window.CREOVATE_MEMBER = {setup};
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
  const RUSH_PRICES = {'social-pack': 31850, 'brand-kit': 54600};
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
  let settings = {};
  const slugFor = name => ({'Logo design':'logo','Flyer / poster':'flyer','Social media post':'social-post','Social media pack':'social-pack','Business card':'business-card','Full brand kit':'brand-kit'}[name] || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
  const knownServiceSlugs = ['logo', 'flyer', 'social-post', 'social-pack', 'business-card', 'brand-kit'];
  document.querySelectorAll('.service-card').forEach((card, index) => { if (!card.dataset.serviceSlug && knownServiceSlugs[index]) card.dataset.serviceSlug = knownServiceSlugs[index]; });
  Array.from(service.options).filter(option => option.dataset.launch).forEach((option, index) => { if (!option.dataset.slug && knownServiceSlugs[index]) option.dataset.slug = knownServiceSlugs[index]; });
  let services = Array.from(service.options).filter(option => option.dataset.launch).map(option => ({slug: option.dataset.slug || slugFor(option.value), name: option.value, launch_price: Number(option.dataset.launch), standard_price: Number(option.dataset.standard), rush_enabled: option.dataset.rush === 'true'}));
  const selectedService = () => services.find(item => item.slug === (service.options[service.selectedIndex]?.dataset.slug || slugFor(service.value))) || null;

  const updateQuote = () => {
    const selected = selectedService();
    if (!selected) {
      price.textContent = 'Choose a service';
      priceNote.textContent = 'One clear price for each service. Full payment is required before work begins.';
      rush.checked = false;
      rush.disabled = true;
      rushOption.classList.remove('is-available');
      return;
    }
    const base = Number(selected.launch_price);
    const rushAvailable = Boolean(selected.rush_enabled && RUSH_PRICES[selected.slug]);
    rush.disabled = !rushAvailable;
    if (!rushAvailable) rush.checked = false;
    rushOption.classList.toggle('is-available', rushAvailable);
    const rushPrice = RUSH_PRICES[selected.slug] || base;
    const current = rush.checked ? rushPrice : base;
    price.textContent = formatNaira(current);
    priceNote.textContent = rushAvailable ? `Service price: ${formatNaira(base)}. Rush delivery total: ${formatNaira(rushPrice)}.` : 'One clear price for this service. Full payment is required before work begins.';
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
      if (priceElement) priceElement.textContent = formatNaira(item.launch_price);
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

  form.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    const selected = selectedService();
    if (!selected) return;
    const currentBase = Number(selected.launch_price);
    const rushSelected = Boolean(data.get('rush')) && selected.rush_enabled;
    const currentPrice = rushSelected ? (RUSH_PRICES[selected.slug] || currentBase) : currentBase;
    const lines = [
      'Hi CREOVATE - DesignHub, I want to send a design brief and arrange payment here on WhatsApp.', '',
      `Service: ${selected.name}`, `Name: ${data.get('name')}`, `Email: ${data.get('email')}`,
      `Business name: ${data.get('business')}`, `Brand name: ${data.get('brand')}`,
      `Price for this brief: ${formatNaira(currentPrice)}${rushSelected ? ' (rush)' : ''}`,
      `Deadline: ${data.get('deadline') || 'Not specified'}`,
      '', `About the business or brand:\n${data.get('description')}`, '', `How I want it to look:\n${data.get('direction')}`,
      '', `Words and details to include:\n${data.get('copy') || 'Not specified'}`, '', `Reference link(s): ${data.get('references') || 'None'}`,
      '', 'Please confirm the final amount and send the payment link or instructions here on WhatsApp.'
    ];
    const whatsappUrl = `https://wa.me/2348084002972?text=${encodeURIComponent(lines.join('\n'))}`;
    const whatsappWindow = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    if (whatsappWindow) whatsappWindow.opener = null;
    status.textContent = 'Your brief opened in WhatsApp. Confirm the final price and payment instructions in that chat.';
  });
  window.CREOVATE_MEMBER.setup(form, gate, status);
  loadPublicSettings();
})();
