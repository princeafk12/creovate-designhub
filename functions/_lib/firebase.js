const jsonHeaders = {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'};

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {status, headers: {...jsonHeaders, ...headers}});
}

function bearer(request) {
  const value = request.headers.get('authorization') || '';
  return value.startsWith('Bearer ') ? value.slice(7).trim() : '';
}

export async function firebaseUser(request, env) {
  const idToken = bearer(request);
  const apiKey = env.FIREBASE_WEB_API_KEY || env.FIREBASE_API_KEY;
  if (!idToken || !apiKey) return null;
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({idToken})
  });
  if (!response.ok) return null;
  const body = await response.json().catch(() => ({}));
  const user = Array.isArray(body.users) ? body.users[0] : null;
  return user?.localId ? {uid: user.localId, email: String(user.email || '').toLowerCase(), idToken} : null;
}

const base64url = value => {
  const bytes = value instanceof Uint8Array ? value : new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const pemBytes = pem => {
  const body = String(pem || '').replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s+/g, '');
  const binary = atob(body);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
};

async function adminAccessToken(env) {
  if (!env.FIREBASE_SERVICE_ACCOUNT_JSON) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured.');
  const account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (!account.client_email || !account.private_key) throw new Error('The Firebase service-account secret is incomplete.');
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({alg: 'RS256', typ: 'JWT'}));
  const claim = base64url(JSON.stringify({iss: account.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600}));
  const signingInput = `${header}.${claim}`;
  const key = await crypto.subtle.importKey('pkcs8', pemBytes(account.private_key), {name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256'}, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput)));
  const response = await fetch('https://oauth2.googleapis.com/token', {method: 'POST', headers: {'content-type': 'application/x-www-form-urlencoded'}, body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${encodeURIComponent(`${signingInput}.${base64url(signature)}`)}`});
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) throw new Error(body.error_description || 'Firebase server authorization failed.');
  return body.access_token;
}

const firestoreValue = value => {
  if (value === null || value === undefined) return {nullValue: null};
  if (typeof value === 'boolean') return {booleanValue: value};
  if (typeof value === 'number' && Number.isInteger(value)) return {integerValue: String(value)};
  if (typeof value === 'number') return {doubleValue: value};
  if (Array.isArray(value)) return {arrayValue: {values: value.map(firestoreValue)}};
  if (typeof value === 'object') return {mapValue: {fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, firestoreValue(item)]))}};
  return {stringValue: String(value)};
};

const fromFirestoreValue = value => {
  if (!value) return null;
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(fromFirestoreValue);
  if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, item]) => [key, fromFirestoreValue(item)]));
  return null;
};

const firestoreUrl = (env, collection, documentId) => `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID || 'creovate-designhub')}/databases/(default)/documents/${collection}/${encodeURIComponent(documentId)}`;

export async function firestoreAdminGet({env, collection, documentId}) {
  const response = await fetch(firestoreUrl(env, collection, documentId), {headers: {authorization: `Bearer ${await adminAccessToken(env)}`}});
  if (response.status === 404) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error?.message || `Firestore read failed (${response.status}).`);
  return Object.fromEntries(Object.entries(body.fields || {}).map(([key, value]) => [key, fromFirestoreValue(value)]));
}

export async function firestoreAdminWrite({env, collection, documentId, fields}) {
  const response = await fetch(firestoreUrl(env, collection, documentId), {method: 'PATCH', headers: {'content-type': 'application/json', authorization: `Bearer ${await adminAccessToken(env)}`}, body: JSON.stringify({fields: Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, firestoreValue(value)]))})});
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error?.message || `Firestore write failed (${response.status}).`);
  return body;
}
