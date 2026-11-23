(() => {
  const form = document.querySelector('#promo-studio-form');
  const status = document.querySelector('#promo-studio-status');
  if (!form || !status) return;

  const setStatus = (text, error = false) => {
    status.textContent = text;
    status.classList.toggle('is-error', error);
  };

  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[character]));
  const labels = {campaign_strategy: 'Campaign strategy', target_audience_angle: 'Target audience angle', headlines: 'Headline options', main_promotional_copy: 'Main promotional copy', flyer_ready_text: 'Flyer-ready text', whatsapp_message: 'WhatsApp message', instagram_caption: 'Instagram caption', facebook_post: 'Facebook post', x_post: 'X post', call_to_actions: 'Call-to-action suggestions', hashtags: 'Hashtags', visual_direction: 'Visual direction'};
  const renderValue = value => Array.isArray(value) ? `<ul>${value.map(item => `<li>${escape(item)}</li>`).join('')}</ul>` : `<p>${escape(value).replace(/\n/g, '<br>')}</p>`;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const session = await window.CREOVATE_MEMBER?.getSession?.();
    if (!session) { window.location.href = 'signup.html?next=index.html%23business-tools'; return; }
    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    setStatus('Preparing your secure ₦1,000 checkout…');
    try {
      const response = await fetch('/api/checkout', {method: 'POST', headers: {'content-type': 'application/json', authorization: `Bearer ${session.access_token}`}, body: JSON.stringify({product_slug: 'promo_studio', customer_name: new FormData(form).get('business_name'), brief: Object.fromEntries(new FormData(form).entries())})});
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.checkout_url) throw new Error(body.error || 'Secure checkout is not configured yet.');
      setStatus('Your brief is saved. Complete payment, then the server will generate and save your campaign.');
      let link = form.parentElement.querySelector('[data-promo-checkout-link]');
      if (!link) {
        link = document.createElement('a');
        link.dataset.promoCheckoutLink = 'true';
        link.className = 'button button-dark';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        form.parentElement.appendChild(link);
      }
      link.href = body.checkout_url;
      link.textContent = 'Pay ₦1,000 and continue';
    } catch (error) { setStatus(error.message, true); }
    finally { if (button) button.disabled = false; }
  });
})();
