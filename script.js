(() => {
  window.CREOVATE_SUPABASE_URL = window.CREOVATE_SUPABASE_URL || 'https://makiwckhhycpjhfqtail.supabase.co';
  window.CREOVATE_SUPABASE_KEY = window.CREOVATE_SUPABASE_KEY || 'sb_publishable_hh6nQhgj140KaE0_IjykQw_Wm6oJj3c';
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#site-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      nav.classList.toggle('is-open', !open);
    });
    nav.addEventListener('click', event => {
      if (event.target.matches('a') && window.innerWidth <= 760) {
        toggle.setAttribute('aria-expanded', 'false');
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
  const fallbackSettings = {launch_active: true, launch_spots_total: 15, launch_spots_remaining: 15, discount_percent: 30, rush_percent: 30};
  let settings = {...fallbackSettings};
  const slugFor = name => ({'Logo design':'logo','Flyer / poster':'flyer','Social media post':'social-post','Social media pack':'social-pack','Business card':'business-card','Full brand kit':'brand-kit'}[name] || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
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
      const item = services.find(serviceItem => serviceItem.name === name);
      if (!item) return;
      card.dataset.serviceSlug = item.slug;
      const priceElement = card.querySelector('.price');
      if (priceElement) priceElement.innerHTML = `${formatNaira(activeLaunch() ? item.launch_price : item.standard_price)} <del>${formatNaira(activeLaunch() ? item.standard_price : item.launch_price)}</del>`;
      const meta = card.querySelector('.meta');
      if (meta && item.delivery_time) meta.textContent = `Delivery: ${item.delivery_time}`;
    });
    Array.from(service.options).forEach(option => {
      const item = services.find(serviceItem => serviceItem.name === option.textContent.trim());
      if (!item) return;
      option.dataset.slug = item.slug;
      option.dataset.launch = item.launch_price;
      option.dataset.standard = item.standard_price;
      option.dataset.rush = item.rush_enabled;
    });
    const label = document.querySelector('#launch-label');
    const offer = document.querySelector('#offer-copy');
    if (label) label.textContent = activeLaunch() ? `Launch offer: first ${settings.launch_spots_total} bookings only` : 'Launch offer ended — standard prices now apply';
    if (offer) offer.innerHTML = activeLaunch() ? `<strong>${settings.discount_percent}% off</strong> every design service for the first <strong>${settings.launch_spots_remaining} remaining booking(s)</strong> after launch. Standard prices apply after those bookings are taken.` : '<strong>Launch offer ended.</strong> Standard prices now apply to all new bookings.';
    updateQuote();
  };

  const loadPublicSettings = async () => {
    if (!window.supabase || !window.CREOVATE_SUPABASE_URL || !window.CREOVATE_SUPABASE_KEY) return;
    try {
      const db = window.creovateSupabase || (window.creovateSupabase = window.supabase.createClient(window.CREOVATE_SUPABASE_URL, window.CREOVATE_SUPABASE_KEY));
      const [{data: settingsData}, {data: servicesData}] = await Promise.all([
        db.from('site_settings').select('*').eq('id', 1).maybeSingle(),
        db.from('services').select('*').order('name')
      ]);
      if (settingsData) settings = {...settings, ...settingsData};
      if (servicesData?.length) services = servicesData;
      applyPublicSettings();
    } catch (error) { /* Static fallback remains usable if the database is not configured yet. */ }
  };

  service.addEventListener('change', updateQuote);
  rush.addEventListener('change', updateQuote);
  updateQuote();
  document.querySelectorAll('.service-card a[href^="https://wa.me/"]').forEach(link => {
    link.textContent = 'Start this brief';
    link.addEventListener('click', event => {
      event.preventDefault();
      service.value = link.closest('.service-card').querySelector('h3').textContent.trim();
      updateQuote();
      document.querySelector('#brief').scrollIntoView({behavior: 'smooth'});
      service.focus({preventScroll: true});
    });
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const session = await window.CREOVATE_MEMBER.getSession();
    if (!session) { window.location.href = 'login.html?next=index.html%23brief'; return; }
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
    status.textContent = 'Opening WhatsApp with your completed brief…';
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    try {
      const db = window.creovateSupabase;
      if (db) {
        await db.from('orders').insert({user_id: session.user.id, service_slug: selected.slug, service_name: selected.name, price: currentPrice, rush: rushSelected, brief: Object.fromEntries(data.entries())});
      }
    } catch (error) { /* WhatsApp delivery remains available even when saving is unavailable. */ }
  });
  window.CREOVATE_MEMBER.setup(form, gate, status);
  loadPublicSettings();
})();

(() => {
  const form = document.querySelector('#validator-form');
  const result = document.querySelector('#validator-result');
  if (!form || !result) return;
  const gate = document.querySelector('#validator-gate');

  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[character]));
  const bullets = values => values.map(value => `<li>${escape(value)}</li>`).join('');

  form.addEventListener('submit', event => {
    event.preventDefault();
    evaluate(form, result);
  });

  async function evaluate(currentForm, output) {
    const session = await window.CREOVATE_MEMBER.getSession();
    if (!session) { window.location.href = 'login.html?next=index.html%23validator'; return; }
    const data = new FormData(currentForm);
    const idea = String(data.get('idea') || '').trim();
    const audience = String(data.get('audience') || '').trim();
    const location = String(data.get('location') || '').trim();
    const goal = String(data.get('goal') || '').trim();
    const budget = String(data.get('budget') || '').trim();
    let score = 25;
    const strengths = [];
    const gaps = [];
    const nextSteps = [];

    if (idea.length >= 40) { score += 20; strengths.push('You described the idea with useful detail.'); }
    else if (idea.length >= 20) { score += 10; gaps.push('Make the idea more specific: what exactly will you sell or deliver?'); }
    else gaps.push('Add a clearer description of the product or service.');
    if (audience.length >= 10) { score += 20; strengths.push('You named a target customer.'); }
    else gaps.push('Define the first customer group you want to serve.');
    if (location) { score += 10; strengths.push('You identified where the business will operate.'); }
    else gaps.push('Choose a first location or explain that it will operate online.');
    if (goal) { score += 10; strengths.push('You selected a clear business goal.'); }
    else gaps.push('Choose the main result you want from the idea.');
    if (budget && budget !== 'unknown') { score += 10; strengths.push('You have started thinking about launch resources.'); }
    else gaps.push('Set a rough starting budget before committing to launch costs.');
    if (/\b(sell|service|product|delivery|app|shop|design|food)\b/i.test(idea)) score += 5;
    score = Math.min(score, 100);

    if (!gaps.length) gaps.push('Keep validating the idea with real potential customers.');
    nextSteps.push('Speak to at least five potential customers and ask what they currently use instead.');
    nextSteps.push('Write down your first offer, price range and how someone will place an order.');
    if (budget === 'unknown') nextSteps.push('Estimate the smallest realistic launch budget and monthly running cost.');
    const verdict = score >= 75 ? 'Strong starting point' : score >= 50 ? 'Promising but needs clarity' : 'Needs more definition';

    let saved = true;
    try {
      const {error} = await window.CREOVATE_MEMBER.client().from('validator_checks').insert({
        user_id: session.user.id,
        idea,
        audience,
        location,
        goal,
        budget,
        score,
        verdict,
        result: {strengths, gaps, next_steps: nextSteps}
      });
      if (error) saved = false;
    } catch (error) { saved = false; }
    result.hidden = false;
    result.innerHTML = `<div class="validator-score">${score}/100</div><h3>${escape(verdict)}</h3><p>This is a free first-pass estimate based only on your answers. It is not market research, legal advice, financial advice or a guarantee of success.</p><h4>What looks good</h4><ul>${bullets(strengths.length ? strengths : ['You have started turning an idea into a plan.'])}</ul><h4>What to improve</h4><ul>${bullets(gaps)}</ul><h4>Useful next steps</h4><ul>${bullets(nextSteps)}</ul><p class="validator-save-status">${saved ? 'Saved to your customer account.' : 'Result shown, but it could not be saved. Please try again after the database migration is complete.'}</p>`;
    result.scrollIntoView({behavior: 'smooth', block: 'nearest'});
  }
  window.CREOVATE_MEMBER.setup(form, gate, result);
})();
