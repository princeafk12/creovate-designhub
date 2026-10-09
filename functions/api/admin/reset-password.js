import {json, serviceHeaders, supabaseBase, currentUser} from '../../_lib/supabase.js';

const OWNER_EMAIL = 'olanitealabij2023@gmail.com';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function onRequestPost({request, env}) {
  try {
    const user = await currentUser(request, env);
    if (!user) return json({error: 'You must be signed in as the owner.'}, 401);
    if (String(user.email || '').toLowerCase() !== OWNER_EMAIL) return json({error: 'Owner access is required.'}, 403);

    const publicKey = env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
    const authorization = request.headers.get('authorization') || '';
    if (!publicKey || !/^Bearer\s+\S+/i.test(authorization)) return json({error: 'Authentication is not configured.'}, 503);
    const adminCheck = await fetch(`${supabaseBase(env)}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,email,role`, {
      headers: {apikey: publicKey, authorization, accept: 'application/json'}
    });
    const adminProfiles = adminCheck.ok ? await adminCheck.json() : [];
    if (!Array.isArray(adminProfiles) || adminProfiles[0]?.role !== 'admin' || String(adminProfiles[0]?.email || '').toLowerCase() !== OWNER_EMAIL) {
      return json({error: 'Owner administrator access is required.'}, 403);
    }

    const body = await request.json().catch(() => ({}));
    const userId = String(body.user_id || '').trim();
    const newPassword = String(body.new_password || '');
    if (!UUID.test(userId)) return json({error: 'Choose a valid customer account.'}, 400);
    if (userId === user.id) return json({error: 'Use the normal account recovery process for the owner account.'}, 400);
    if (newPassword.length < 8 || newPassword.length > 72) return json({error: 'The temporary password must be 8 to 72 characters.'}, 400);

    const target = await fetch(`${supabaseBase(env)}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,email,role`, {
      headers: serviceHeaders(env, {accept: 'application/json'})
    });
    const targetProfiles = target.ok ? await target.json() : [];
    if (!Array.isArray(targetProfiles) || !targetProfiles.length || targetProfiles[0]?.role === 'admin') return json({error: 'Only customer accounts can be reset here.'}, 400);

    const response = await fetch(`${supabaseBase(env)}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      headers: serviceHeaders(env, {'content-type': 'application/json', accept: 'application/json'}),
      body: JSON.stringify({password: newPassword})
    });
    if (!response.ok) {
      const detail = await response.text();
      return json({error: `Supabase could not update this password (${response.status}).`, detail: detail.slice(0, 300)}, 502);
    }
    return json({message: `Temporary password set for ${targetProfiles[0].email || 'the customer'}. Give it to them privately.`});
  } catch (error) {
    return json({error: error.message || 'Password reset is not configured yet.'}, /not configured/i.test(error.message || '') ? 503 : 500);
  }
}
