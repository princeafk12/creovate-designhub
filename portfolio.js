(() => {
  const staticItems = [
    ['01-editing-desk.jpg', 'The Editing Desk campaign', 'Flyers & campaigns'], ['02-timthreadz-fashion.jpg', 'TimThreadz fashion campaign', 'Flyers & campaigns'], ['03-creovate-flyer.jpg', 'CREOVATE Digital Space flyer', 'Flyers & campaigns'], ['04-riyash-couture.jpg', 'Riyash Couture campaign', 'Flyers & campaigns'], ['05-ramadan-day12.jpg', 'Ramadan Day 12 campaign', 'Flyers & campaigns'], ['06-ramadan-fasting-soul.jpg', 'Feed a Fasting Soul campaign', 'Flyers & campaigns'], ['07-ramadan-day14.jpg', 'Ramadan Day 14 campaign', 'Flyers & campaigns'], ['08-talent-flyer.jpg', 'Talent campaign poster', 'Flyers & campaigns'], ['09-sr-brand-mockup.jpg', 'SR brand mockup', 'Brand identity'], ['10-righteous-school.jpg', 'Righteous School campaign', 'Education'], ['11-business-owners.jpg', 'Business Owners campaign', 'Flyers & campaigns'], ['12-resumption-class.jpg', 'Class resumption campaign', 'Education'], ['13-digiflux-brand.jpg', 'Digiflux identity concept', 'Brand identity'], ['14-campus-resumption.jpg', 'Campus resumption campaign', 'Education'], ['15-editing-desk-video.jpg', 'The Editing Desk video campaign', 'Flyers & campaigns'], ['16-creovate-brand-grid.jpg', 'CREOVATE brand grid', 'Brand identity'], ['17-creovate-brand-story.jpg', 'CREOVATE brand story', 'Brand identity'], ['18-creovate-logo-system.jpg', 'CREOVATE logo system', 'Brand identity'], ['19-gold-business-flyer.jpg', 'Business growth flyer', 'Flyers & campaigns'], ['20-timthreadz-flyer.jpg', 'TimThreadz promotional flyer', 'Flyers & campaigns'], ['21-taste-haven-flyer.jpg', 'Taste Haven food campaign', 'Flyers & campaigns'], ['22-creovate-brand-board.jpg', 'CREOVATE brand board', 'Brand identity'], ['23-chatgpt-side-hustle.jpg', 'ChatGPT Side Hustle Course', 'Digital products'], ['24-lautech-resumption.jpg', 'LAUTECH resumption campaign', 'Education'], ['25-affiliate-rescue.jpg', 'Affiliate Rescue Playbook', 'Digital products'], ['26-creovate-mockup.jpg', 'CREOVATE stationery mockup', 'Brand identity'], ['27-brand-words.jpg', 'Brand words system', 'Brand identity'], ['28-brand-statement.jpg', 'CREOVATE brand statement', 'Brand identity'], ['29-mobile-mockup.jpg', 'CREOVATE mobile mockup', 'Brand identity'], ['30-laptop-mockup.jpg', 'CREOVATE laptop mockup', 'Brand identity'], ['31-brand-board-dark.jpg', 'Dark brand board', 'Brand identity'], ['32-visual-system.jpg', 'CREOVATE visual system', 'Brand identity'], ['33-strategy-design.jpg', 'Strategy and design campaign', 'Brand identity'], ['34-customers-quality.jpg', 'Customers and quality campaign', 'Brand identity'], ['35-design-board.jpg', 'CREOVATE design board', 'Brand identity'], ['36-afos-logo.jpg', 'AFOS Stitches & Clothing logo', 'Brand identity'], ['37-creovate-business-class.jpg', 'CREOVATE free business class', 'Digital products'], ['38-afos-clothing.jpg', 'AFOS Clothing & Stitches campaign', 'Flyers & campaigns'], ['39-job-application.jpg', 'Job application workshop', 'Education'], ['40-success-examinations.jpg', 'Success in your examinations', 'Education'], ['41-wednesday-alushroh.jpg', 'Wednesday Al-Ushroh programme', 'Education'], ['42-cheap-data-deals.jpg', 'Cheap data deals campaign', 'Flyers & campaigns'], ['43-afaq-knowledge.jpg', 'AFAQ Circle identity', 'Brand identity'], ['44-picnic-2026.jpg', 'Campus picnic campaign', 'Flyers & campaigns'], ['45-vote-campaign.jpg', 'Student election campaign', 'Flyers & campaigns'], ['46-smell-good.jpg', 'Smell Good fragrance campaign', 'Flyers & campaigns'], ['47-wednesday-alushroh-green.jpg', 'Wednesday Al-Ushroh green campaign', 'Education'], ['48-cb-logo.jpg', 'CB logo concept', 'Brand identity'], ['49-riyash-couture.jpg', 'Riyash Couture service card', 'Flyers & campaigns'], ['50-start-somewhere.jpg', 'Start Somewhere design course', 'Digital products']
  ].map(([image, title, category]) => ({image, title, category}));
  let items = staticItems;
  const grid = document.querySelector('#portfolio-grid');
  const filters = document.querySelector('#portfolio-filters');
  const count = document.querySelector('#portfolio-count');
  const modal = document.querySelector('#portfolio-modal');
  const modalImage = document.querySelector('#portfolio-modal-image');
  const modalTitle = document.querySelector('#portfolio-modal-title');
  const modalCategory = document.querySelector('#portfolio-modal-category');
  const close = document.querySelector('#portfolio-close');
  const placeholder = 'portfolio/placeholder.svg';
  if (!grid || !filters || !count || !modal || !modalImage || !modalTitle || !modalCategory || !close) return;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[character]));
  const imageUrl = item => {
    if (item.remote) return item.image || item.image_url || placeholder;
    const version = ['01-editing-desk.jpg', '03-creovate-flyer.jpg', '11-business-owners.jpg'].includes(item.image) ? '?v=20261128' : '';
    return `portfolio/images/${item.image}${version}`;
  };
  let active = 'All work';
  let activeModalItem = null;
  const renderFilters = () => {
    const categories = ['All work', ...new Set(items.map(item => item.category))];
    filters.innerHTML = categories.map(category => `<button class="portfolio-filter${category === active ? ' is-active' : ''}" type="button" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join('');
  };
  const revealCards = () => {
    const cards = [...grid.querySelectorAll('.portfolio-card-reveal')];
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      cards.forEach(card => card.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }), {rootMargin: '0px 0px -7% 0px', threshold: .08});
    cards.forEach(card => observer.observe(card));
  };
  const render = () => {
    const visible = active === 'All work' ? items : items.filter(item => item.category === active);
    count.textContent = `${visible.length} selected ${visible.length === 1 ? 'piece' : 'pieces'}`;
    grid.innerHTML = visible.map((item, index) => {
      const url = imageUrl(item);
      return `<a class="portfolio-card portfolio-card-reveal" style="--portfolio-delay:${Math.min(index, 8) * 45}ms" href="${escapeHtml(url)}" data-index="${items.indexOf(item)}"><img src="${escapeHtml(url)}" alt="${escapeHtml(item.title)}" loading="${index < 6 ? 'eager' : 'lazy'}"><span class="portfolio-card-body"><span class="portfolio-card-title">${escapeHtml(item.title)}</span><span class="portfolio-card-category">${escapeHtml(item.category)}</span></span></a>`;
    }).join('');
    revealCards();
  };
  const openModal = item => {
    activeModalItem = item;
    modalImage.src = imageUrl(item);
    modalImage.alt = item.title;
    modalTitle.textContent = item.title;
    modalCategory.textContent = item.category;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    close.focus();
  };
  const loadRemoteItems = async () => {
    try {
      const response = await fetch('/api/portfolio', {cache: 'no-store'});
      if (!response.ok) throw new Error('Portfolio uploads could not be loaded.');
      const body = await response.json();
      const remoteItems = (body.items || []).map(item => ({remote: true, ...item}))
        .filter(item => item.title && item.image_url);
      if (!remoteItems.length) return;
      items = [...remoteItems, ...staticItems];
      renderFilters();
      render();
    } catch (error) {
      console.warn('CREOVATE portfolio uploads could not be loaded.', error);
    }
  };
  const closeModal = () => {
    modal.hidden = true;
    activeModalItem = null;
    modalImage.src = '';
    document.body.style.overflow = '';
  };
  filters.addEventListener('click', event => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    active = button.dataset.category;
    renderFilters();
    render();
  });
  grid.addEventListener('click', event => {
    const card = event.target.closest('.portfolio-card');
    if (!card) return;
    event.preventDefault();
    openModal(items[Number(card.dataset.index)]);
  });
  close.addEventListener('click', closeModal);
  modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !modal.hidden) closeModal(); });
  renderFilters();
  render();
  loadRemoteItems();
})();
