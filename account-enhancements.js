(async () => {
  const user = await window.CREOVATE_AUTH.requireUser();
  if (!user) return;
  const db = window.CREOVATE_AUTH.client();
  const escape = window.CREOVATE_AUTH.escapeHtml;
  const list = document.querySelector('#orders-list');
  const {data: orders, error: ordersError} = await db.from('orders').select('service_name,price,rush,status,payment_status,created_at').order('created_at', {ascending: false});
  if (list) {
    if (ordersError) list.innerHTML = `<p class="form-status is-error">${escape(ordersError.message)}</p>`;
    else list.innerHTML = orders?.length ? orders.map(order => `<article class="order-card"><strong>${escape(order.service_name)}</strong><span>₦${Number(order.price).toLocaleString('en-NG')}${order.rush ? ' · Rush' : ''}</span><small>${new Date(order.created_at).toLocaleString('en-NG')} · ${escape(order.status)} · Payment: ${escape(order.payment_status || 'pending')}</small></article>`).join('') : '<p>No saved briefs yet. Your next brief will appear here after you send it.</p>';
  }
  const checksSection = document.createElement('section');
  checksSection.className = 'auth-card';
  checksSection.innerHTML = '<h2>My validator checks</h2><div id="account-validator-checks" class="orders-list"></div>';
  document.querySelector('main')?.appendChild(checksSection);
  const checksBox = checksSection.querySelector('#account-validator-checks');
  const {data: checks, error: checkError} = await db.from('validator_checks').select('idea,score,verdict,created_at').order('created_at', {ascending: false}).limit(25);
  if (checkError) checksBox.innerHTML = `<p class="form-status is-error">${escape(checkError.message)}</p>`;
  else checksBox.innerHTML = checks?.length ? checks.map(check => `<article class="order-card"><strong>${Number(check.score)}/100 · ${escape(check.verdict)}</strong><small>${new Date(check.created_at).toLocaleString('en-NG')} · ${escape(check.idea)}</small></article>`).join('') : '<p>No validator checks yet.</p>';
})();
