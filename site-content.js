(() => {
  if (!window.CREOVATE_AUTH || !document.querySelector('[data-content-text], [data-content-url], [data-content-email]')) return;

  const apply = content => {
    const values = content && typeof content === 'object' ? content : {};
    document.querySelectorAll('[data-content-text]').forEach(element => {
      const value = values[element.dataset.contentText];
      if (typeof value === 'string' && value.trim()) element.textContent = value;
    });
    document.querySelectorAll('[data-content-url]').forEach(element => {
      const value = values[element.dataset.contentUrl];
      if (typeof value === 'string' && /^https?:\/\//i.test(value.trim())) element.href = value.trim();
    });
    document.querySelectorAll('[data-content-email]').forEach(element => {
      const value = values.contact_email;
      if (typeof value === 'string' && value.trim()) {
        element.href = `mailto:${value.trim()}`;
        element.textContent = value.trim();
      }
    });
  };

  window.CREOVATE_AUTH.client().from('site_settings').select('*').eq('id', 1).maybeSingle()
    .then(({data}) => apply(data?.content || {}));
})();
