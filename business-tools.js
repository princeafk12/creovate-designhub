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
  const renderResult = result => `<div class="tool-result"><div class="tool-result-heading"><h4>Your Promo Studio campaign package</h4><button class="text-button" type="button" data-copy-result>Copy result</button></div>${Object.entries(labels).filter(([key]) => result[key]).map(([key, label]) => `<section><h5>${label}</h5>${renderValue(result[key])}</section>`).join('')}</div>`;

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const session = await window.CREOVATE_MEMBER?.getSession?.();
    if (!session) { window.location.href = 'signup.html?next=index.html%23business-tools'; return; }
    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    setStatus('Checking Promo Studio availability…');
    try {
      const response = await fetch('/api/generate-promo', {method: 'POST', headers: {'content-type': 'application/json', authorization: `Bearer ${session.access_token}`}, body: JSON.stringify(Object.fromEntries(new FormData(form).entries()))});
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Promo Studio is unavailable.');
      form.insertAdjacentHTML('afterend', renderResult(body.result || {}));
      setStatus('Campaign package generated and saved to your account.');
      const resultBox = form.parentElement.querySelector('.tool-result:last-of-type');
      resultBox?.querySelector('[data-copy-result]')?.addEventListener('click', async eventToCopy => { await navigator.clipboard.writeText(resultBox.innerText); eventToCopy.currentTarget.textContent = 'Copied'; });
    } catch (error) { setStatus(error.message, true); }
    finally { if (button) button.disabled = false; }
  });
})();
