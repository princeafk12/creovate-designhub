(async () => {
  const OWNER_EMAIL = 'olanitealabij2023@gmail.com';
  window.CREOVATE_SUPABASE_URL = window.CREOVATE_SUPABASE_URL || 'https://makiwckhhycpjhfqtail.supabase.co';
  window.CREOVATE_SUPABASE_KEY = window.CREOVATE_SUPABASE_KEY || 'sb_publishable_hh6nQhgj140KaE0_IjykQw_Wm6oJj3c';
  const publicBase = () => {
    const marker = '/creovate-designhub/';
    const path = window.location.pathname;
    const markerIndex = path.indexOf(marker);
    return markerIndex >= 0 ? `${window.location.origin}${path.slice(0, markerIndex + marker.length)}` : `${window.location.origin}/`;
  };
  const publicUrl = file => new URL(file, publicBase()).toString();
  const configReady = () => Boolean(window.supabase && window.CREOVATE_SUPABASE_URL && window.CREOVATE_SUPABASE_KEY);
  const client = () => {
    if (!configReady()) throw new Error('Authentication is not configured yet.');
    if (!window.creovateSupabase) window.creovateSupabase = window.supabase.createClient(window.CREOVATE_SUPABASE_URL, window.CREOVATE_SUPABASE_KEY);
    return window.creovateSupabase;
  };
  const message = (element, text, error = false) => {
    if (!element) return;
    element.textContent = text;
    element.classList.toggle('is-error', error);
  };
  const requestedNext = fallback => {
    const next = new URLSearchParams(window.location.search).get('next') || '';
    if (next === 'index.html' || next.startsWith('index.html#') || next === 'account.html') return next;
    return fallback;
  };
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[character]));
  const profileFor = async user => {
    if (!user) return null;
    const { data, error } = await client().from('profiles').select('id,email,role').eq('id', user.id).maybeSingle();
    if (error) throw error;
    return data;
  };
  const requireUser = async (next = '') => {
    const { data } = await client().auth.getSession();
    if (!data.session) {
      const suffix = next ? `?next=${encodeURIComponent(next)}` : '';
      window.location.href = `signup.html${suffix}`;
      return null;
    }
    return data.session.user;
  };
  const verifiedTotpFactors = async () => {
    const { data, error } = await client().auth.mfa.listFactors();
    if (error) throw error;
    return (data?.totp || []).filter(factor => factor.status === 'verified');
  };
  const continueAdminMfa = async () => {
    const factors = await verifiedTotpFactors();
    if (!factors.length) {
      window.location.href = 'mfa.html?mode=enroll&next=admin.html';
      return false;
    }
    const { data, error } = await client().auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) throw error;
    if (data?.currentLevel !== 'aal2') {
      window.location.href = 'mfa.html?mode=verify&next=admin.html';
      return false;
    }
    return true;
  };
  const requireAdmin = async () => {
    const user = await requireUser();
    if (!user) return null;
    const profile = await profileFor(user);
    if (!profile || profile.role !== 'admin' || String(user.email || '').toLowerCase() !== OWNER_EMAIL) {
      await client().auth.signOut();
      window.location.href = 'admin-login.html?error=admin';
      return null;
    }
    if (!(await continueAdminMfa())) return null;
    return {user, profile};
  };

  document.querySelectorAll('[data-logout]').forEach(button => button.addEventListener('click', async () => {
    try { await client().auth.signOut(); window.location.href = 'index.html'; }
    catch (error) { message(document.querySelector('[data-auth-message]'), error.message, true); }
  }));

  const loginForm = document.querySelector('#login-form');
  if (loginForm) loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    const status = document.querySelector('[data-auth-message]');
    const data = new FormData(loginForm);
    message(status, 'Signing you in…');
    try {
      const { data: result, error } = await client().auth.signInWithPassword({email: data.get('email'), password: data.get('password')});
      if (error) throw error;
      const profile = await profileFor(result.user);
      window.location.href = profile?.role === 'admin' ? 'admin.html' : requestedNext('account.html');
    } catch (error) { message(status, error.message, true); }
  });

  const signupForm = document.querySelector('#signup-form');
  if (signupForm) signupForm.addEventListener('submit', async event => {
    event.preventDefault();
    const status = document.querySelector('[data-auth-message]');
    const data = new FormData(signupForm);
    if (data.get('password') !== data.get('confirm_password')) { message(status, 'The passwords do not match.', true); return; }
    message(status, 'Creating your account…');
    try {
      const { data: result, error } = await client().auth.signUp({email: data.get('email'), password: data.get('password'), options: {data: {full_name: data.get('name')}, emailRedirectTo: publicUrl('login.html')}});
      if (error) throw error;
      if (result.session) window.location.href = requestedNext('account.html');
      else message(status, 'Account created. You can now log in.');
    } catch (error) {
      message(status, error.message, true);
    }
  });

  const resetToggle = document.querySelector('#reset-toggle');
  const resetInline = document.querySelector('#reset-inline');
  const resetCancel = document.querySelector('#reset-cancel');
  const setResetOpen = open => {
    if (!resetInline || !resetToggle) return;
    resetInline.hidden = !open;
    resetToggle.setAttribute('aria-expanded', String(open));
    if (open) resetInline.querySelector('input')?.focus();
  };
  resetToggle?.addEventListener('click', () => setResetOpen(true));
  resetCancel?.addEventListener('click', () => setResetOpen(false));

  const resetRequestForm = document.querySelector('#reset-request-form');
  if (resetRequestForm) resetRequestForm.addEventListener('submit', async event => {
    event.preventDefault();
    const status = document.querySelector('[data-auth-message]');
    const email = new FormData(resetRequestForm).get('email');
    message(status, 'Sending the reset link…');
    try {
      const {error} = await client().auth.resetPasswordForEmail(email, {redirectTo: publicUrl('reset.html')});
      if (error) throw error;
      message(status, 'If an account exists for that email, a password-reset link has been sent.');
    } catch (error) { message(status, error.message, true); }
  });

  const adminLoginForm = document.querySelector('#admin-login-form');
  if (adminLoginForm) adminLoginForm.addEventListener('submit', async event => {
    event.preventDefault();
    const status = document.querySelector('[data-auth-message]');
    const data = new FormData(adminLoginForm);
    message(status, 'Checking administrator access…');
    try {
      const {data: result, error} = await client().auth.signInWithPassword({email: data.get('email'), password: data.get('password')});
      if (error) throw error;
      const profile = await profileFor(result.user);
      if (String(result.user?.email || '').toLowerCase() !== OWNER_EMAIL || profile?.role !== 'admin') {
        await client().auth.signOut();
        throw new Error('Only the CREOVATE owner account may use the administrator area.');
      }
      if (await continueAdminMfa()) window.location.href = 'admin.html';
    } catch (error) { message(status, error.message, true); }
  });

  const updatePasswordForm = document.querySelector('#update-password-form');
  if (updatePasswordForm) {
    const status = document.querySelector('[data-auth-message]');
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const hashError = hashParams.get('error_description') || hashParams.get('error');
    if (hashError) {
      updatePasswordForm.hidden = true;
      message(status, 'This password-reset link is invalid or has expired. Request a new link from the login page.', true);
    } else {
      message(status, 'Preparing the secure password-reset session…');
      let sessionReady = Boolean((await client().auth.getSession()).data.session);
      if (!sessionReady) {
        await new Promise(resolve => {
          let finished = false;
          let subscription;
          const finish = () => {
            if (finished) return;
            finished = true;
            subscription?.unsubscribe?.();
            resolve();
          };
          const result = client().auth.onAuthStateChange(event => {
            if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') finish();
          });
          subscription = result?.data?.subscription;
          window.setTimeout(finish, 1800);
        });
        sessionReady = Boolean((await client().auth.getSession()).data.session);
      }
      if (sessionReady) message(status, 'Enter and confirm your new password.');
      else {
        updatePasswordForm.hidden = true;
        message(status, 'This password-reset link did not open a valid recovery session. Request a new link from the login page and open it in the same browser.', true);
      }
    }
    updatePasswordForm.addEventListener('submit', async event => {
      event.preventDefault();
      const data = new FormData(updatePasswordForm);
      if (data.get('password') !== data.get('confirm_password')) { message(status, 'The passwords do not match.', true); return; }
      try {
        const {error} = await client().auth.updateUser({password: data.get('password')});
        if (error) throw error;
        updatePasswordForm.hidden = true;
        message(status, 'Password updated. You can now use your new password. Return to login to sign in.');
      } catch (error) { message(status, error.message, true); }
    });
  }

  document.querySelectorAll('[data-auth-switch]').forEach(link => {
    const target = link.getAttribute('data-auth-switch');
    const next = new URLSearchParams(window.location.search).get('next');
    if (next && (target === 'login.html' || target === 'signup.html')) link.href = `${target}?next=${encodeURIComponent(next)}`;
  });

  window.CREOVATE_AUTH = {client, profileFor, requireUser, requireAdmin, verifiedTotpFactors, continueAdminMfa, escapeHtml, message, OWNER_EMAIL};
})();
