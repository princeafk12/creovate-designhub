(() => {
  const pendingClass = 'auth-pending';
  const revealPage = () => document.documentElement.classList.remove(pendingClass);
  const mode = document.currentScript?.dataset.mode || 'customer';

  // Customer pages are public. Only the owner dashboard keeps an access check.
  if (mode !== 'admin') {
    revealPage();
    return;
  }

  const redirectToAdminLogin = () => window.location.replace('admin-login.html');
  if (!window.CREOVATE_AUTH) {
    redirectToAdminLogin();
    return;
  }

  Promise.race([
    window.CREOVATE_AUTH.requireAdmin().then(Boolean),
    new Promise((_, reject) => window.setTimeout(() => reject(new Error('Authentication timed out')), 12000))
  ]).then(allowed => {
    if (allowed) revealPage();
    else redirectToAdminLogin();
  }).catch(redirectToAdminLogin);
})();
