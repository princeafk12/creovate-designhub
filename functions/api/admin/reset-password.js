import {firebaseUser, firestoreAdminGet, json} from '../../_lib/firebase.js';

const OWNER_EMAIL = 'olanitealabij2023@gmail.com';

export async function onRequestPost({request, env}) {
  try {
    const user = await firebaseUser(request, env);
    if (!user) return json({error: 'Sign in again to continue.'}, 401);
    if (user.email !== OWNER_EMAIL) return json({error: 'Owner access is required.'}, 403);

    const ownerProfile = await firestoreAdminGet({env, collection: 'profiles', documentId: user.uid});
    if (ownerProfile?.role !== 'admin' || String(ownerProfile.email || '').toLowerCase() !== OWNER_EMAIL) {
      return json({error: 'Owner administrator access is required.'}, 403);
    }

    const body = await request.json().catch(() => ({}));
    const userId = String(body.user_id || '').trim();
    if (!userId || userId.length > 128) return json({error: 'Choose a customer account.'}, 400);
    if (userId === user.uid) return json({error: 'Use the owner account recovery process for your own account.'}, 400);

    const target = await firestoreAdminGet({env, collection: 'profiles', documentId: userId});
    const email = String(target?.email || '').trim().toLowerCase();
    if (!target || !email || target.role === 'admin') return json({error: 'Only customer accounts with a saved email can receive a reset link.'}, 400);

    const apiKey = env.FIREBASE_WEB_API_KEY || env.FIREBASE_API_KEY;
    if (!apiKey) return json({error: 'Firebase password recovery is not configured.'}, 503);
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({requestType: 'PASSWORD_RESET', email})
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = result.error?.message || '';
      return json({error: /EMAIL_NOT_FOUND/i.test(detail) ? 'That customer account could not be found in Firebase Authentication.' : 'Firebase could not send the password reset email. Check the Firebase email/password settings.'}, 502);
    }
    return json({message: `A password reset link was sent to ${email}.`});
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const configurationError = /not configured|service-account|Firebase server authorization/i.test(message);
    return json({error: configurationError ? 'Firebase account support is not configured.' : 'The password reset request could not be completed.'}, configurationError ? 503 : 500);
  }
}
