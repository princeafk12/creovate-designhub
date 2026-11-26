import {firebaseUser, firestoreAdminQuery, json} from '../../_lib/firebase.js';

const newestFirst = (rows, field) => rows.sort((left, right) => Date.parse(right[field] || '') - Date.parse(left[field] || ''));

export async function onRequestGet({request, env}) {
  const user = await firebaseUser(request, env);
  if (!user) return json({error: 'Sign in again to view your account.'}, 401);
  try {
    const [orders, jobs, checks] = await Promise.all([
      firestoreAdminQuery({env, collection: 'orders', where: [['user_id', user.uid]], limit: 50}),
      firestoreAdminQuery({env, collection: 'generation_jobs', where: [['user_id', user.uid]], limit: 50}),
      firestoreAdminQuery({env, collection: 'validator_checks', where: [['user_id', user.uid]], limit: 25})
    ]);
    return json({
      orders: newestFirst(orders, 'created_at'),
      jobs: newestFirst(jobs, 'created_at'),
      checks: newestFirst(checks, 'created_at')
    });
  } catch (error) {
    console.error('CREOVATE account data load failed', error);
    return json({error: 'Saved account activity is temporarily unavailable. Please refresh in a moment.'}, 503);
  }
}
