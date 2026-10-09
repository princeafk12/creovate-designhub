export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders
    }
  });
}

export function supabaseBase(env) {
  const value = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) throw new Error('SUPABASE_URL is not configured.');
  return value.replace(/\/$/, '');
}

export function serviceHeaders(env, extra = {}) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    ...extra
  };
}

export async function supabaseRest(env, resource, options = {}) {
  const headers = serviceHeaders(env, {
    accept: 'application/json',
    ...options.headers
  });
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  const response = await fetch(`${supabaseBase(env)}/rest/v1/${resource}`, {
    ...options,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return {response, data};
}

export async function currentUser(request, env) {
  const authorization = request.headers.get('authorization') || '';
  if (!/^Bearer\s+\S+/i.test(authorization)) return null;
  const key = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
  if (!key) throw new Error('SUPABASE_PUBLISHABLE_KEY is not configured.');
  const response = await fetch(`${supabaseBase(env)}/auth/v1/user`, {
    headers: { apikey: key, authorization }
  });
  if (!response.ok) return null;
  return response.json();
}

export function safeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export async function sendEmail(env, {to, subject, html, text, idempotencyKey}) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return {skipped: true};
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
      ...(idempotencyKey ? {'idempotency-key': idempotencyKey} : {})
    },
    body: JSON.stringify({from: env.EMAIL_FROM, to, subject, html, text})
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Email provider error: ${response.status} ${body}`);
  return body ? JSON.parse(body) : {};
}

