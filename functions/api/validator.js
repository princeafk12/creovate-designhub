import {currentUser, json} from '../_lib/supabase.js';

export async function onRequestPost({request, env}) {
  const user = await currentUser(request, env);
  if (!user) return json({error: 'Sign in before using the validator.'}, 401);
  return json({
    error: 'The live business validator is coming soon. It is temporarily unavailable while we complete verification and safety checks.'
  }, 503, {'cache-control': 'no-store'});
}
