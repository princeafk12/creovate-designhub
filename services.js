(() => {
  const cards = Array.from(document.querySelectorAll('.service-card'));
  if (!cards.length) return;

  const formatNaira = value => `₦${Number(value).toLocaleString('en-NG')}`;
  const rushPrices = {'social-pack': 31850, 'brand-kit': 54600};

  const render = services => {
    cards.forEach(card => {
      const link = card.querySelector('[data-service-slug]');
      const item = services.find(service => service.slug === link?.dataset.serviceSlug);
      if (!item) return;

      const price = card.querySelector('.price');
      if (price) price.textContent = formatNaira(item.launch_price);
      const delivery = card.querySelector('.meta');
      if (delivery && item.delivery_time) delivery.textContent = `Delivery: ${item.delivery_time}`;
      const description = card.children[3];
      if (description && item.description) description.textContent = item.description;

      const rush = card.querySelector('.rush');
      if (rush && item.rush_enabled && rushPrices[item.slug]) {
        rush.innerHTML = `Rush total: ${formatNaira(rushPrices[item.slug])} <span>(time agreed first)</span>`;
      } else if (rush) rush.remove();
    });
  };

  const load = async () => {
    if (!window.CREOVATE_AUTH) return;
    try {
      const {data} = await window.CREOVATE_AUTH.client().from('services').select('*').order('name');
      if (data?.length) render(data);
    } catch {
      // Keep the published prices if public service data is unavailable.
    }
  };

  load();
})();
