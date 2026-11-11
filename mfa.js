import { getAuth, multiFactor, reauthenticateWithCredential, EmailAuthProvider, TotpMultiFactorGenerator } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js';

(() => {
  const OWNER_EMAIL = 'olanitealabij2023@gmail.com';
  const config = window.CREOVATE_FIREBASE_CONFIG;
  const status = document.querySelector('#mfa-status');
  const startForm = document.querySelector('#mfa-start-form');
  const verifyForm = document.querySelector('#mfa-verify-form');
  const enrollment = document.querySelector('#mfa-enrollment');
  const secretBox = document.querySelector('#mfa-secret');
  const qrCanvas = document.querySelector('#mfa-qr');
  let totpSecret = null;

  const message = (text, error = false) => {
    if (window.CREOVATE_AUTH?.message) window.CREOVATE_AUTH.message(status, text, error);
    else if (status) { status.textContent = text; status.classList.toggle('is-error', error); }
  };

  if (!config || !startForm) return;

  let auth;
  try {
    const app = window.firebase?.apps?.length ? window.firebase.app() : window.firebase?.initializeApp(config);
    auth = getAuth(app);
  } catch (error) {
    message('The authenticator setup could not start. Please refresh and try again.', true);
    return;
  }

  const user = auth.currentUser;
  if (!user || String(user.email || '').toLowerCase() !== OWNER_EMAIL) {
    window.location.href = 'admin-login.html';
    return;
  }
  if (!user.emailVerified) {
    message('Verify the owner email first, then return to administrator login.', true);
    startForm.hidden = true;
  }
  if (multiFactor(user).enrolledFactors.length) {
    message('An authenticator is already enrolled. Return to administrator login.');
    startForm.hidden = true;
  }

  startForm.addEventListener('submit', async event => {
    event.preventDefault();
    const password = String(new FormData(startForm).get('password') || '');
    message('Preparing your authenticator setup…');
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
      const session = await multiFactor(user).getSession();
      totpSecret = await TotpMultiFactorGenerator.generateSecret(session);
      const uri = totpSecret.generateQrCodeUrl(user.email, 'CREOVATE DesignHub');
      if (!window.QRCode?.toCanvas) throw new Error('The QR-code library did not load. Refresh and try again.');
      await window.QRCode.toCanvas(qrCanvas, uri, {width: 240, margin: 2});
      secretBox.textContent = totpSecret.secretKey;
      enrollment.hidden = false;
      startForm.hidden = true;
      message('Scan the QR code, then enter the six-digit code from your authenticator app.');
    } catch (error) {
      message(error.message || 'Authenticator setup could not start.', true);
    }
  });

  verifyForm.addEventListener('submit', async event => {
    event.preventDefault();
    const code = String(new FormData(verifyForm).get('code') || '').replace(/\D/g, '');
    if (!totpSecret || !/^\d{6}$/.test(code)) { message('Enter the six-digit authenticator code.', true); return; }
    const submit = verifyForm.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    message('Confirming your authenticator…');
    try {
      await multiFactor(user).enroll(TotpMultiFactorGenerator.assertionForEnrollment(totpSecret, code), 'CREOVATE admin authenticator');
      await auth.signOut();
      window.location.href = 'admin-login.html?enrolled=1';
    } catch (error) {
      if (submit) submit.disabled = false;
      message(error.message || 'The authenticator code could not be confirmed.', true);
    }
  });
})();
