(() => {
  const allowedPages = new Set([
    'index.html', 'services.html', 'brief.html', 'portfolio.html',
    'how-it-works.html', 'faq.html', 'policies.html', 'contact.html',
    'account.html', 'payment-return.html'
  ]);
  const parts = window.location.pathname.split('/').filter(Boolean);
  const leaf = parts.at(-1) || 'index.html';
  const page = leaf.endsWith('.html') ? leaf : `${leaf}.html`;
  const targetPage = allowedPages.has(page) ? page : 'index.html';
  const service = new URLSearchParams(window.location.search).get('service');
  const validServices = new Set(['logo', 'flyer', 'social-post', 'social-pack', 'business-card', 'brand-kit']);
  let next = targetPage;
  if (targetPage === 'brief.html' && validServices.has(service)) next += `?service=${service}`;
  if (/^#[-a-zA-Z0-9_]{1,80}$/.test(window.location.hash)) next += window.location.hash;

  const pendingClass = 'auth-pending';
  const revealPage = () => document.documentElement.classList.remove(pendingClass);
  const loginUrl = `login.html?next=${encodeURIComponent(next)}`;
  const mode = document.currentScript?.dataset.mode || 'customer';
  const redirectToLogin = () => window.location.replace(mode === 'admin' ? 'admin-login.html' : loginUrl);

  if (!window.CREOVATE_AUTH) {
    redirectToLogin();
    return;
  }

  const checkAccess = mode === 'admin'
    ? window.CREOVATE_AUTH.requireAdmin().then(access => Boolean(access))
    : window.CREOVATE_AUTH.client().auth.getSession().then(({data}) => Boolean(data?.session));

  Promise.race([
    checkAccess,
    new Promise((_, reject) => window.setTimeout(() => reject(new Error('Authentication timed out')), 12000))
  ]).then(allowed => {
    if (allowed) revealPage();
    else redirectToLogin();
  }).catch(redirectToLogin);
})();
