(() => {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#site-nav');
  if (!toggle || !nav) return;

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
})();

(() => {
  const form = document.querySelector('#brief-form');
  if (!form) return;

  const service = form.elements.namedItem('service');
  const status = document.querySelector('#brief-status');

  document.querySelectorAll('[data-service]').forEach(link => {
    link.addEventListener('click', () => {
      service.value = link.dataset.service;
    });
  });

  document.querySelectorAll('.service-card a[href^="https://wa.me/"]').forEach(link => {
    link.textContent = 'Start this brief';
    link.addEventListener('click', event => {
      event.preventDefault();
      service.value = link.closest('.service-card').querySelector('h3').textContent;
      document.querySelector('#brief').scrollIntoView({behavior: 'smooth'});
      service.focus({preventScroll: true});
    });
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form);
    const lines = [
      'Hi CREOVATE - DesignHub, I want to send a design brief.',
      '',
      `Service: ${data.get('service')}`,
      `Name: ${data.get('name')}`,
      `Email: ${data.get('email')}`,
      `Business name: ${data.get('business')}`,
      `Brand name: ${data.get('brand')}`,
      `Deadline: ${data.get('deadline') || 'Not specified'}`,
      '',
      `About the business or brand:\n${data.get('description')}`,
      '',
      `How I want it to look:\n${data.get('direction')}`,
      '',
      `Words and details to include:\n${data.get('copy') || 'Not specified'}`,
      '',
      `Reference link(s): ${data.get('references') || 'None'}`
    ];

    const whatsappUrl = `https://wa.me/2348084002972?text=${encodeURIComponent(lines.join('\n'))}`;
    status.textContent = 'Opening WhatsApp with your completed brief…';
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  });
})();
