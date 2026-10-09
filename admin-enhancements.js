(async () => {
  const access = await window.CREOVATE_AUTH.requireAdmin();
  if (!access) return;
  const db = window.CREOVATE_AUTH.client();
  const escape = window.CREOVATE_AUTH.escapeHtml;
  const ordersBox = document.querySelector('#admin-orders');
  const servicesStatus = document.querySelector('#services-status');
  const {data: orders, error: ordersError} = await db.from('orders').select('id,service_name,price,rush,status,payment_status,created_at,brief').order('created_at', {ascending: false}).limit(25);
  if (ordersBox) {
    if (ordersError) ordersBox.innerHTML = `<p class="form-status is-error">${escape(ordersError.message)}</p>`;
    else ordersBox.innerHTML = orders?.length ? orders.map(order => `<article class="order-card"><strong>${escape(order.service_name)}</strong><span>₦${Number(order.price).toLocaleString('en-NG')}${order.rush ? ' · Rush' : ''}</span><label>Payment <select data-payment-order="${escape(order.id)}"><option value="pending" ${(order.payment_status || 'pending') === 'pending' ? 'selected' : ''}>Pending</option><option value="paid" ${order.payment_status === 'paid' ? 'selected' : ''}>Paid / confirmed</option><option value="failed" ${order.payment_status === 'failed' ? 'selected' : ''}>Failed</option><option value="refunded" ${order.payment_status === 'refunded' ? 'selected' : ''}>Refunded</option></select></label><small>${new Date(order.created_at).toLocaleString('en-NG')} · ${escape(order.status)} · ${escape(order.brief?.name || '')}</small></article>`).join('') : '<p>No saved orders yet.</p>';
  }
  document.querySelectorAll('[data-payment-order]').forEach(select => select.addEventListener('change', async () => {
    const payment_status = select.value;
    const result = await db.from('orders').update({payment_status, paid_at: payment_status === 'paid' ? new Date().toISOString() : null}).eq('id', select.dataset.paymentOrder);
    if (servicesStatus) { servicesStatus.textContent = result.error ? result.error.message : 'Payment status saved.'; servicesStatus.classList.toggle('is-error', Boolean(result.error)); }
  }));
  const checksBox = document.querySelector('#admin-validator-checks');
  if (!checksBox) return;
  const {data: checks, error: checkError} = await db.from('validator_checks').select('idea,audience,score,verdict,created_at').order('created_at', {ascending: false}).limit(25);
  if (checkError) { checksBox.innerHTML = `<p class="form-status is-error">${escape(checkError.message)}</p>`; return; }
  checksBox.innerHTML = checks?.length ? checks.map(check => `<article class="order-card"><strong>${Number(check.score)}/100 · ${escape(check.verdict)}</strong><span>${escape(check.audience)}</span><small>${new Date(check.created_at).toLocaleString('en-NG')} · ${escape(check.idea)}</small></article>`).join('') : '<p>No validator checks yet.</p>';
})();
