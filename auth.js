(() => {
  window.CREOVATE_SUPABASE_URL = window.CREOVATE_SUPABASE_URL || 'https://makiwckhhycpjhfqtail.supabase.co';
  window.CREOVATE_SUPABASE_KEY = window.CREOVATE_SUPABASE_KEY || 'sb_publishable_hh6nQhgj140KaE0_IjykQw_Wm6oJj3c';
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
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[character]));
  const profileFor = async user => {
    if (!user) return null;
    const { data, error } = await client().from('profiles').select('id,email,role').eq('id', user.id).maybeSingle();
    if (error) throw error;
    return data;
  };
  const requireUser = async () => {
    const { data } = await client().auth.getSession();
    if (!data.session) { window.location.href = 'login.html'; return null; }
    return data.session.user;
  };
  const requireAdmin = async () => {
    const user = await requireUser();
    if (!user) return null;
    const profile = await profileFor(user);
    if (!profile || profile.role !== 'admin') {
      await client().auth.signOut();
      window.location.href = 'admin-login.html?error=admin';
      return null;
    }
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
      window.location.href = profile?.role === 'admin' ? 'admin.html' : 'account.html';
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
      const { data: result, error } = await client().auth.signUp({email: data.get('email'), password: data.get('password'), options: {data: {full_name: data.get('name')}}});
      if (error) throw error;
      if (result.session) window.location.href = 'account.html';
      else message(status, 'Account created. Check your email to confirm your account, then log in.');
    } catch (error) { message(status, error.message, true); }
  });

  const resetRequestForm = document.querySelector('#reset-request-form');
  if (resetRequestForm) resetRequestForm.addEventListener('submit', async event => {
    event.preventDefault();
    const status = document.querySelector('[data-auth-message]');
    const email = new FormData(resetRequestForm).get('email');
    message(status, 'Sending the reset link…');
    try {
      const {error} = await client().auth.resetPasswordForEmail(email, {redirectTo: `${window.location.origin}/reset.html`});
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
      if (profile?.role !== 'admin') { await client().auth.signOut(); throw new Error('This account is not an administrator account.'); }
      window.location.href = 'admin.html';
    } catch (error) { message(status, error.message, true); }
  });

  const updatePasswordForm = document.querySelector('#update-password-form');
  if (updatePasswordForm) updatePasswordForm.addEventListener('submit', async event => {
    event.preventDefault();
    const status = document.querySelector('[data-auth-message]');
    const data = new FormData(updatePasswordForm);
    if (data.get('password') !== data.get('confirm_password')) { message(status, 'The passwords do not match.', true); return; }
    try {
      const {error} = await client().auth.updateUser({password: data.get('password')});
      if (error) throw error;
      message(status, 'Password updated. You can now use your new password.');
    } catch (error) { message(status, error.message, true); }
  });

  window.CREOVATE_AUTH = {client, profileFor, requireUser, requireAdmin, escapeHtml, message};
})();
