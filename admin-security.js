import { getAuth, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js';

(() => {
  const OWNER_EMAIL = 'olanitealabij2023@gmail.com';
  const config = window.CREOVATE_FIREBASE_CONFIG;
  const status = document.querySelector('[data-auth-message]');
  const loginForm = document.querySelector('#admin-login-form');
  const resetButton = document.querySelector('#reset-security-questions');
  const setupSection = document.querySelector('#admin-security-setup');
  const setupForm = document.querySelector('#admin-security-setup-form');
  const challengeSection = document.querySelector('#admin-security-challenge');
  const challengeForm = document.querySelector('#admin-security-challenge-form');
  const questionOptions = {
    school: 'What was the name of your first school?',
    city: 'In what city were you born?',
    nickname: 'What was your childhood nickname?',
    pet: 'What was the name of your first pet?',
    business: 'What was the first business you started?'
  };

  const message = (text, error = false) => {
    if (window.CREOVATE_AUTH?.message) window.CREOVATE_AUTH.message(status, text, error);
    else if (status) { status.textContent = text; status.classList.toggle('is-error', error); }
  };
  const normalize = value => String(value || '').trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
  const bytesToHex = bytes => Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
  const hashAnswer = async (answer, salt) => bytesToHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${normalize(answer)}`)));
  const randomSalt = () => {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return bytesToHex(bytes);
  };
  const constantTimeEqual = (left, right) => {
    if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) return false;
    let difference = 0;
    for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
    return difference === 0;
  };
  const profileStore = () => firebase.firestore();
  const ownerOnly = user => String(user?.email || '').toLowerCase() === OWNER_EMAIL;
  const show = (element, visible) => { if (element) element.hidden = !visible; };

  if (!config || !loginForm || !setupForm || !challengeForm) return;

  let auth;
  try {
    const app = window.firebase?.apps?.length ? window.firebase.app() : window.firebase?.initializeApp(config);
    auth = getAuth(app);
  } catch (error) {
    message('The secure admin login could not start. Please refresh and try again.', true);
    return;
  }

  const showSetup = () => {
    show(loginForm, false);
    show(challengeSection, false);
    show(setupSection, true);
    message('Set two private security questions before entering the admin area.');
    setupForm.querySelector('select[name="question1"]')?.focus();
  };
  const showChallenge = questions => {
    const first = questions[0];
    const second = questions[1];
    document.querySelector('#security-question-1').textContent = first.prompt;
    document.querySelector('#security-question-2').textContent = second.prompt;
    show(loginForm, false);
    show(setupSection, false);
    show(challengeSection, true);
    message('Answer both security questions to enter the admin area.');
    challengeForm.querySelector('input[name="answer1"]')?.focus();
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
      const profileRef = profileStore().collection('profiles').doc(user.uid);
      const profileSnapshot = await profileRef.get();
      const profile = profileSnapshot.exists ? profileSnapshot.data() : {};
      const questions = Array.isArray(profile.security_questions) ? profile.security_questions : [];
      if (questions.length !== 2 || questions.some(question => !question.prompt || !question.hash || !question.salt)) showSetup();
      else showChallenge(questions);
    } catch (error) {
      if (error.code === 'auth/multi-factor-auth-required') {
        await signOut(auth);
        message('An old extra sign-in factor is still attached to this Firebase account. Remove it in Firebase Authentication, then try again.', true);
        return;
      }
      message(error.message || 'Administrator login failed.', true);
    }
  });

  resetButton?.addEventListener('click', async () => {
    const data = new FormData(loginForm);
    const email = String(data.get('email') || '').trim().toLowerCase();
    const password = String(data.get('password') || '');
    if (email !== OWNER_EMAIL || !password) { message('Enter the owner email and password first, then choose reset.', true); return; }
    if (!window.confirm('Reset only the saved security questions so you can choose new ones?')) return;
    resetButton.disabled = true;
    message('Verifying the owner account and resetting security questions…');
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      if (!ownerOnly(credential.user)) throw new Error('Only the CREOVATE owner may reset these questions.');
      await profileStore().collection('profiles').doc(credential.user.uid).set({security_questions: firebase.firestore.FieldValue.delete()}, {merge: true});
      await signOut(auth);
      loginForm.reset();
      show(setupSection, false);
      show(challengeSection, false);
      show(loginForm, true);
      message('Security questions reset. Sign in again to choose new ones.');
    } catch (error) {
      message(error.message || 'The security questions could not be reset.', true);
    } finally {
      resetButton.disabled = false;
    }
  });

  setupForm.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(setupForm);
    const id1 = String(data.get('question1') || '');
    const id2 = String(data.get('question2') || '');
    const answer1 = String(data.get('answer1') || '');
    const answer2 = String(data.get('answer2') || '');
    if (!questionOptions[id1] || !questionOptions[id2] || id1 === id2) { message('Choose two different security questions.', true); return; }
    if (normalize(answer1).length < 3 || normalize(answer2).length < 3) { message('Each answer must contain at least three characters.', true); return; }
    const submit = setupForm.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    message('Saving your security questions…');
    try {
      const user = auth.currentUser;
      if (!user || !ownerOnly(user)) throw new Error('Your owner session expired. Sign in again.');
      const firstSalt = randomSalt();
      const secondSalt = randomSalt();
      await profileStore().collection('profiles').doc(user.uid).set({
        security_questions: [
          {id: id1, prompt: questionOptions[id1], salt: firstSalt, hash: await hashAnswer(answer1, firstSalt)},
          {id: id2, prompt: questionOptions[id2], salt: secondSalt, hash: await hashAnswer(answer2, secondSalt)}
        ]
      }, {merge: true});
      await signOut(auth);
      window.location.href = 'admin-login?security=ready';
    } catch (error) {
      if (submit) submit.disabled = false;
      message(error.message || 'The security questions could not be saved.', true);
    }
  });

  challengeForm.addEventListener('submit', async event => {
    event.preventDefault();
    const data = new FormData(challengeForm);
    const user = auth.currentUser;
    if (!user || !ownerOnly(user)) { message('Your owner session expired. Sign in again.', true); return; }
    const profileSnapshot = await profileStore().collection('profiles').doc(user.uid).get();
    const questions = profileSnapshot.exists && Array.isArray(profileSnapshot.data().security_questions) ? profileSnapshot.data().security_questions : [];
    if (questions.length !== 2) { await signOut(auth); window.location.href = 'admin-login'; return; }
    const firstHash = await hashAnswer(data.get('answer1'), questions[0].salt);
    const secondHash = await hashAnswer(data.get('answer2'), questions[1].salt);
    if (!constantTimeEqual(firstHash, questions[0].hash) || !constantTimeEqual(secondHash, questions[1].hash)) {
      await signOut(auth);
      show(loginForm, true);
      show(challengeSection, false);
      message('One or both security answers are incorrect.', true);
      return;
    }
    window.location.href = 'admin.html';
  });
})();
