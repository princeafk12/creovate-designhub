(() => {
  const form = document.querySelector('#promo-studio-form');
  const status = document.querySelector('#promo-studio-status');
  if (!form || !status) return;

  const setStatus = (text, error = false) => {
    status.textContent = text;
    status.classList.toggle('is-error', error);
  };

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    setStatus('Your Promo Studio brief is complete. Generation and payment will be connected after the secure AI and payment workflow is tested. No payment has been requested.');
  });
})();
