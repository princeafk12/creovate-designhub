import { getAuth, getMultiFactorResolver, sendEmailVerification, signInWithEmailAndPassword, signOut, TotpMultiFactorGenerator } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js';

(() => {
  const OWNER_EMAIL = 'olanitealabij2023@gmail.com';
  const config = window.CREOVATE_FIREBASE_CONFIG;
  const status = document.querySelector('[data-auth-message]');
  const loginForm = document.querySelector('#admin-login-form');
  const mfaForm = document.querySelector('#admin-mfa-form');
  const challenge = document.querySelector('#admin-mfa-challenge');
  let resolver = null;
  let totpHint = null;

  const message = (text, error = false) => {
    if (window.CREOVATE_AUTH?.message) window.CREOVATE_AUTH.message(status, text, error);
    else if (status) { status.textContent = text; status.classList.toggle('is-error', error); }
  };

  if (!config || !loginForm) return;

  let auth;
  try {
    const app = window.firebase?.apps?.length ? window.firebase.app() : window.firebase?.initializeApp(config);
    auth = getAuth(app);
  } catch (error) {
    message('The secure admin login could not start. Please refresh and try again.', true);
    return;
  }

  const ownerOnly = user => String(user?.email || '').toLowerCase() === OWNER_EMAIL;
  const showChallenge = () => {
    loginForm.hidden = true;
    challenge.hidden = false;
    document.querySelector('#admin-mfa-form input[name="code"]')?.focus();
    message('Enter the six-digit code from your authenticator app.');
  };

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(loginForm);
    const email = String(data.get('email') || '').trim().toLowerCase();
    const password = String(data.get('password') || '');
    message('Checking administrator access…');
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const user = credential.user;
      if (!ownerOnly(user)) {
        await signOut(auth);
        message('Only the CREOVATE owner account may use the administrator area.', true);
        return;
      }
      if (!user.emailVerified) {
        await sendEmailVerification(user);
        message('Verify the owner email using the Firebase message, then return here and sign in again.', true);
        return;
      }
      if (!user.multiFactor.enrolledFactors.length) {
        window.location.href = 'mfa.html?mode=enroll&next=admin.html';
        return;
      }
      message('Your authenticator is enrolled, but Firebase did not request its code. The project TOTP provider still needs to be enabled.', true);
    } catch (error) {
      if (error.code === 'auth/multi-factor-auth-required') {
        resolver = getMultiFactorResolver(auth, error);
        totpHint = resolver.hints.find(hint => hint.factorId === TotpMultiFactorGenerator.FACTOR_ID);
        if (!totpHint) { message('No supported authenticator factor was found for this account.', true); return; }
        showChallenge();
        return;
      }
      message(error.message || 'Administrator login failed.', true);
    }
  });

  mfaForm?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!resolver || !totpHint) { message('Start the administrator login again.', true); return; }
    const code = String(new FormData(mfaForm).get('code') || '').replace(/\D/g, '');
    if (!/^\d{6}$/.test(code)) { message('Enter the six-digit authenticator code.', true); return; }
    const submit = mfaForm.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    message('Verifying your authenticator code…');
    try {
      await resolver.resolveSignIn(TotpMultiFactorGenerator.assertionForSignIn(totpHint.uid, code));
      window.location.href = 'admin.html';
    } catch (error) {
      if (submit) submit.disabled = false;
      message(error.message || 'The authenticator code could not be verified.', true);
    }
  });
})();
