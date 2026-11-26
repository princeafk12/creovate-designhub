(() => {
  const grid = document.querySelector('#tool-grid');
  if (!grid) return;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[character]));
  const money = (amount, currency) => `${currency === 'NGN' ? '₦' : ''}${Number(amount).toLocaleString('en-NG')}`;
  const renderField = field => {
    const common = `name="${escape(field.key)}" maxlength="${Number(field.maxLength || 240)}" ${field.required ? 'required' : ''}`;
    const label = field.key === 'contact' ? 'Public business contact (optional)' : field.label;
    if (field.type === 'select') return `<label class="form-field">${escape(field.label)}<select ${common}>${field.required ? '<option value="" selected disabled>Choose one</option>' : '<option value="">Optional</option>'}${field.options.map(option => `<option value="${escape(option)}">${escape(option)}</option>`).join('')}</select></label>`;
    if (field.type === 'textarea') return `<label class="form-field form-field-full">${escape(label)}<textarea ${common} rows="3"></textarea></label>`;
    return `<label class="form-field">${escape(label)}<input ${common} type="text"></label>`;
  };
  const renderTool = (tool, index, enabled) => `<article class="tool-card ${index === 0 ? 'tool-card-featured' : ''}"><div class="tool-card-top"><span class="tool-number">${String(index + 1).padStart(2, '0')}</span><span class="tool-status ${enabled ? '' : 'tool-status-paused'}">${enabled ? 'Available' : 'Temporarily paused'}</span></div><h3>${escape(tool.name)}</h3><p>${escape(tool.description)}</p><div class="tool-price">${money(tool.price, tool.currency)} <span>per generation</span></div><ul class="tool-deliverables">${tool.deliverables.map(item => `<li>${escape(item)}</li>`).join('')}</ul>${!enabled && window.creovateCatalogNotice ? `<p class="form-status is-error">${escape(window.creovateCatalogNotice)}</p>` : ''}<form class="tool-form" data-product-form="${escape(tool.slug)}"><div class="form-grid">${tool.fields.map(renderField).join('')}</div>${tool.slug === 'promo_studio' ? '<p class="form-note">Public business contact details are added to your result after AI generation and are not sent to the AI provider. Do not enter personal, confidential, or sensitive information in the brief.</p>' : '<p class="form-note">Do not enter passwords, payment details, confidential business information, or sensitive personal information. Brief details are processed by the configured AI provider.</p>'}<label class="adult-confirmation"><input name="adult_confirmed" type="checkbox" required> I confirm I am 18 or older and may use these AI tools.</label><div class="tool-actions"><button class="button button-dark" type="submit" ${enabled ? '' : 'disabled'}>Continue to secure payment</button><p class="form-note">Payment is verified by Flutterwave before generation. Results are saved to your customer account.</p></div><p class="form-status" data-tool-status role="status" aria-live="polite"></p><div data-checkout-link></div></form></article>`;

  fetch('/api/tools/catalog', {cache: 'no-store'}).then(async response => {
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !Array.isArray(body.tools)) throw new Error(body.error || 'Could not load current tool prices.');
    window.creovateCatalogNotice = body.notice || '';
    grid.innerHTML = body.tools.map((tool, index) => renderTool(tool, index, body.enabled)).join('');
    grid.addEventListener('submit', async event => {
      const form = event.target.closest('[data-product-form]');
      if (!form) return;
      event.preventDefault();
      if (!form.reportValidity()) return;
      const status = form.querySelector('[data-tool-status]');
      const button = form.querySelector('button[type="submit"]');
      const linkBox = form.querySelector('[data-checkout-link]');
      const session = await window.CREOVATE_MEMBER?.getSession?.();
      if (!session) { window.location.href = `signup.html?next=${encodeURIComponent('business-tools.html')}`; return; }
      button.disabled = true;
      linkBox.innerHTML = '';
      status.textContent = 'Preparing your secure checkout…';
      status.classList.remove('is-error');
      try {
        const formValues = new FormData(form);
        const response = await fetch('/api/checkout', {method: 'POST', headers: {'content-type': 'application/json', authorization: `Bearer ${session.access_token}`}, body: JSON.stringify({product_slug: form.dataset.productForm, customer_name: formValues.get('business_name'), adult_confirmed: formValues.get('adult_confirmed') === 'on', brief: Object.fromEntries(formValues.entries())})});
        const body = await response.json().catch(() => ({}));
        if (!response.ok || !body.checkout_url) throw new Error(body.error || 'Secure checkout could not be started.');
        status.textContent = 'Your brief is saved. Complete the Flutterwave checkout to start generation.';
        const link = document.createElement('a');
        link.className = 'button button-dark'; link.href = body.checkout_url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Open secure Flutterwave checkout';
        linkBox.appendChild(link);
      } catch (error) { status.textContent = error.message; status.classList.add('is-error'); }
      finally { button.disabled = false; }
    });
  }).catch(error => { grid.innerHTML = `<p class="form-status is-error">${escape(error.message)}</p>`; });
})();
