(() => {
  const cards = Array.from(document.querySelectorAll('.service-card'));
  if (!cards.length) return;

  const fallbackSettings = {launch_active: true, launch_spots_total: 15, launch_spots_remaining: 15, discount_percent: 30, offer_message: ''};
  const formatNaira = value => `₦${Number(value).toLocaleString('en-NG')}`;
  let settings = {...fallbackSettings};

  const render = services => {
    const launchActive = Boolean(settings.launch_active) && Number(settings.launch_spots_remaining) > 0;
    cards.forEach(card => {
      const link = card.querySelector('[data-service-slug]');
      const item = services.find(service => service.slug === link?.dataset.serviceSlug);
      if (!item) return;

      const price = card.querySelector('.price');
      if (price) {
        const current = launchActive ? item.launch_price : item.standard_price;
        const previous = launchActive ? item.standard_price : item.launch_price;
        price.textContent = `${formatNaira(current)} `;
        const previousPrice = document.createElement('del');
        previousPrice.textContent = formatNaira(previous);
        price.append(previousPrice);
      }
      const delivery = card.querySelector('.meta');
      if (delivery && item.delivery_time) delivery.textContent = `Delivery: ${item.delivery_time}`;
      const description = card.children[3];
      if (description && item.description) description.textContent = item.description;

      const rush = card.querySelector('.rush');
      if (rush && item.rush_enabled) {
        const base = Number(launchActive ? item.launch_price : item.standard_price);
        rush.innerHTML = `Rush total: ${formatNaira(Math.round(base * 1.3))} <span>(time agreed first)</span>`;
      } else if (rush) rush.remove();
    });

    const offer = document.querySelector('#offer-copy');
    if (offer) {
      offer.textContent = String(settings.offer_message || '').trim() || (launchActive
        ? `${settings.discount_percent}% off every design service for the first ${settings.launch_spots_remaining} remaining booking(s). Standard prices apply after those bookings are taken.`
        : 'Launch offer ended. Standard prices now apply to all new bookings.');
    }
  };

  const load = async () => {
    if (!window.CREOVATE_AUTH) return;
    try {
      const db = window.CREOVATE_AUTH.client();
      const [{data: settingsData}, {data: servicesData}] = await Promise.all([
        db.from('site_settings').select('*').eq('id', 1).maybeSingle(),
        db.from('services').select('*').order('name')
      ]);
      if (settingsData) settings = {...settings, ...settingsData};
      if (servicesData?.length) render(servicesData);
    } catch {
      // Keep the published page fallback if public database reads are unavailable.
    }
  };

  load();
})();
