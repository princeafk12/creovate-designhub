(async () => {
  const OWNER_EMAIL = 'olanitealabij2023@gmail.com';
  const config = window.CREOVATE_FIREBASE_CONFIG;
  const statusFor = error => ({message: error?.message || String(error || 'Unknown error')});
  if (!window.firebase || !config) {
    console.error('Firebase configuration or SDK is missing.');
    return;
  }
  if (!firebase.apps.length) firebase.initializeApp(config);
  const firebaseAuth = firebase.auth();
  const firestore = firebase.firestore();
  let readyResolve;
  const ready = new Promise(resolve => { readyResolve = resolve; });
  firebaseAuth.onAuthStateChanged(user => readyResolve(user));

  const normalizeUser = user => user ? ({
    id: user.uid,
    uid: user.uid,
    email: user.email || '',
    user_metadata: {full_name: user.displayName || ''},
    app_metadata: {}
  }) : null;
  const sessionFor = async user => user ? ({user: normalizeUser(user), access_token: await user.getIdToken()}) : null;
  const firestoreValue = value => value && typeof value.toDate === 'function' ? value.toDate().toISOString() : value;
  const documentValue = snapshot => {
    const value = snapshot.data() || {};
    for (const key of Object.keys(value)) value[key] = firestoreValue(value[key]);
    if (value.id === undefined) value.id = snapshot.id;
    return value;
  };

  class QueryBuilder {
    constructor(collection) { this.collection = collection; this.filters = []; this.sort = null; this.max = null; this.fields = null; this.updateData = null; this.single = false; }
    select(fields = '*') { this.fields = fields; return this; }
    eq(field, value) { this.filters.push([field, value]); return this; }
    order(field, options = {}) { this.sort = [field, options.ascending !== false]; return this; }
    limit(count) { this.max = count; return this; }
    maybeSingle() { this.single = true; return this; }
    update(data) { this.updateData = data; return this; }
    async execute() {
      try {
        const collection = firestore.collection(this.collection);
        let query = collection;
        const whereFilters = this.filters.filter(([field]) => field !== 'id');
        for (const [field, value] of whereFilters) {
          if (field === 'id') continue;
          query = query.where(field, '==', value);
        }
        const canUseFirestoreSort = Boolean(this.sort && whereFilters.length === 0);
        if (canUseFirestoreSort) query = query.orderBy(this.sort[0], this.sort[1] ? 'asc' : 'desc');
        if (this.max && canUseFirestoreSort) query = query.limit(this.max);
        if (this.updateData) {
          const snapshot = await query.get();
          const writes = snapshot.docs.map(doc => doc.ref.update(this.updateData));
          await Promise.all(writes);
          return {data: null, error: null};
        }
        let snapshot;
        const idFilter = this.filters.find(item => item[0] === 'id');
        if (idFilter && this.filters.length === 1) {
          const single = await collection.doc(String(idFilter[1])).get();
          snapshot = {docs: single.exists ? [single] : []};
        } else snapshot = await query.get();
        let data = snapshot.docs.map(documentValue);
        if (this.fields && this.fields !== '*') {
          const names = this.fields.split(',').map(field => field.trim());
          data = data.map(item => Object.fromEntries(names.filter(name => name in item).map(name => [name, item[name]])));
        }
        if (this.sort && !canUseFirestoreSort) {
          const [field, ascending] = this.sort;
          data.sort((left, right) => {
            const a = left[field] ?? '';
            const b = right[field] ?? '';
            const result = a < b ? -1 : a > b ? 1 : 0;
            return ascending ? result : -result;
          });
        }
        if (this.max && !canUseFirestoreSort) data = data.slice(0, this.max);
        return {data: this.single ? (data[0] || null) : data, error: null};
      } catch (error) { return {data: null, error: statusFor(error)}; }
    }
    then(resolve, reject) { return this.execute().then(resolve, reject); }
  }

  const compatClient = () => ({
    from: collection => new QueryBuilder(collection),
    auth: {
      getSession: async () => ({data: {session: await sessionFor(firebaseAuth.currentUser)}, error: null}),
      signInWithPassword: async ({email, password}) => {
        try { const result = await firebaseAuth.signInWithEmailAndPassword(email, password); return {data: {user: normalizeUser(result.user)}, error: null}; }
        catch (error) { return {data: null, error: statusFor(error)}; }
      },
      signUp: async ({email, password, options = {}}) => {
        try {
          const result = await firebaseAuth.createUserWithEmailAndPassword(email, password);
          if (options.data?.full_name) await result.user.updateProfile({displayName: options.data.full_name});
          await firestore.collection('profiles').doc(result.user.uid).set({id: result.user.uid, email: result.user.email, role: result.user.email.toLowerCase() === OWNER_EMAIL ? 'admin' : 'customer', created_at: new Date().toISOString()}, {merge: true});
          return {data: {user: normalizeUser(result.user), session: await sessionFor(result.user)}, error: null};
        } catch (error) { return {data: null, error: statusFor(error)}; }
      },
      signOut: async () => { try { await firebaseAuth.signOut(); return {error: null}; } catch (error) { return {error: statusFor(error)}; } },
      updateUser: async ({password}) => { try { await firebaseAuth.currentUser.updatePassword(password); return {error: null}; } catch (error) { return {error: statusFor(error)}; } },
      onAuthStateChange: callback => {
        const unsubscribe = firebaseAuth.onAuthStateChanged(async user => callback(user ? 'SIGNED_IN' : 'SIGNED_OUT', await sessionFor(user)));
        return {data: {subscription: {unsubscribe}}};
      },
      mfa: {
        listFactors: async () => ({data: {totp: []}, error: null}),
        getAuthenticatorAssuranceLevel: async () => ({data: {currentLevel: 'aal2'}, error: null})
      }
    }
  });
  const client = () => {
    if (!window.creovateFirebaseClient) window.creovateFirebaseClient = compatClient();
    return window.creovateFirebaseClient;
  };
  const message = (element, text, error = false) => { if (element) { element.textContent = text; element.classList.toggle('is-error', error); } };
  const requestedNext = fallback => {
    const next = new URLSearchParams(window.location.search).get('next') || '';
    return next === 'index.html' || next.startsWith('index.html#') || next === 'account.html' ? next : fallback;
  };
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[character]));
  const profileFor = async user => {
    if (!user) return null;
    const result = await firestore.collection('profiles').doc(user.uid).get();
    if (result.exists) return documentValue(result);
    const profile = {id: user.uid, email: user.email || '', role: user.email?.toLowerCase() === OWNER_EMAIL ? 'admin' : 'customer', created_at: new Date().toISOString()};
    await firestore.collection('profiles').doc(user.uid).set(profile, {merge: true});
    return profile;
  };
  const requireUser = async next => {
    const user = firebaseAuth.currentUser || await ready;
    if (!user) { window.location.href = `signup.html${next ? `?next=${encodeURIComponent(next)}` : ''}`; return null; }
    return normalizeUser(user);
  };
  const continueAdminMfa = async () => true;
  const requireAdmin = async () => {
    const user = await requireUser();
    if (!user) return null;
    const profile = await profileFor(user);
    if (!profile || profile.role !== 'admin' || String(user.email).toLowerCase() !== OWNER_EMAIL) {
      await client().auth.signOut(); window.location.href = 'admin-login.html?error=admin'; return null;
    }
    const token = await firebaseAuth.currentUser.getIdTokenResult();
    const secondFactor = token.claims?.firebase?.sign_in_second_factor;
    if (secondFactor !== 'totp') {
      window.location.href = 'admin-login.html?mfa=required'; return null;
    }
    return {user, profile};
  };

  document.querySelectorAll('[data-logout]').forEach(button => button.addEventListener('click', async () => { await client().auth.signOut(); window.location.href = 'index.html'; }));
  const loginForm = document.querySelector('#login-form');
  loginForm?.addEventListener('submit', async event => {
    event.preventDefault(); const status = document.querySelector('[data-auth-message]'); const data = new FormData(loginForm); message(status, 'Signing you in…');
    const {data: result, error} = await client().auth.signInWithPassword({email: data.get('email'), password: data.get('password')});
    if (error) { message(status, error.message, true); return; }
    const profile = await profileFor(result.user); window.location.href = profile?.role === 'admin' ? 'admin-login.html' : requestedNext('account.html');
  });
  const signupForm = document.querySelector('#signup-form');
  signupForm?.addEventListener('submit', async event => {
    event.preventDefault(); const status = document.querySelector('[data-auth-message]'); const data = new FormData(signupForm);
    if (data.get('password') !== data.get('confirm_password')) { message(status, 'The passwords do not match.', true); return; }
    message(status, 'Creating your account…'); const {data: result, error} = await client().auth.signUp({email: data.get('email'), password: data.get('password'), options: {data: {full_name: data.get('name')}}});
    if (error) { message(status, error.message, true); return; }
    if (result.session) window.location.href = requestedNext('account.html'); else message(status, 'Account created. You can now log in.');
  });
  const adminLoginForm = document.querySelector('#admin-login-form');
  if (adminLoginForm && !document.body.dataset.mfaAdmin) adminLoginForm.addEventListener('submit', async event => {
    event.preventDefault(); const status = document.querySelector('[data-auth-message]'); const data = new FormData(adminLoginForm); message(status, 'Checking administrator access…');
    const {data: result, error} = await client().auth.signInWithPassword({email: data.get('email'), password: data.get('password')});
    if (error) { message(status, error.message, true); return; }
    const profile = await profileFor(result.user);
    if (String(result.user.email).toLowerCase() !== OWNER_EMAIL || profile?.role !== 'admin') { await client().auth.signOut(); message(status, 'Only the CREOVATE owner account may use the administrator area.', true); return; }
    window.location.href = 'admin.html';
  });
  const resetRequestForm = document.querySelector('#reset-request-form');
  const whatsappResetLink = document.querySelector('#whatsapp-reset-link');
  if (resetRequestForm && whatsappResetLink) resetRequestForm.addEventListener('submit', event => { event.preventDefault(); const email = String(new FormData(resetRequestForm).get('email') || '').trim(); if (!email) return; whatsappResetLink.href = `https://wa.me/2348084002972?text=${encodeURIComponent(`Hello CREOVATE. I need a password reset for ${email}.`)}`; whatsappResetLink.click(); });
  const updatePasswordForm = document.querySelector('#update-password-form');
  if (updatePasswordForm) updatePasswordForm.addEventListener('submit', async event => { event.preventDefault(); const data = new FormData(updatePasswordForm); const status = document.querySelector('[data-auth-message]'); if (data.get('password') !== data.get('confirm_password')) { message(status, 'The passwords do not match.', true); return; } const result = await client().auth.updateUser({password: data.get('password')}); if (result.error) message(status, result.error.message, true); else message(status, 'Password updated. You can now return to login.'); });
  document.querySelectorAll('input[type="password"]').forEach(input => {
    const wrapper = document.createElement('span');
    wrapper.className = 'password-input-wrap';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'password-toggle';
    toggle.setAttribute('aria-label', 'Show password');
    toggle.setAttribute('title', 'Show password');
    toggle.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2.1 12s3.2-6 9.9-6 9.9 6 9.9 6-3.2 6-9.9 6-9.9-6-9.9-6Z"></path><circle cx="12" cy="12" r="2.6"></circle></svg>';
    toggle.addEventListener('click', () => {
      const visible = input.type === 'text';
      input.type = visible ? 'password' : 'text';
      toggle.setAttribute('aria-label', visible ? 'Show password' : 'Hide password');
      toggle.setAttribute('title', visible ? 'Show password' : 'Hide password');
      toggle.classList.toggle('is-visible', !visible);
    });
    wrapper.appendChild(toggle);
  });
  window.CREOVATE_AUTH = {client, profileFor, requireUser, requireAdmin, verifiedTotpFactors: async () => [], continueAdminMfa, escapeHtml, message, OWNER_EMAIL};
})();


