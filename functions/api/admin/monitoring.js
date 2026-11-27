import {firebaseUser, firestoreAdminGet, firestoreAdminQuery, json} from '../../_lib/firebase.js';

const OWNER_EMAIL = 'olanitealabij2023@gmail.com';
export async function onRequestGet({request, env}) {
  try {
    const user = await firebaseUser(request, env);
    if (!user) return json({error: 'Sign in again to view business monitoring.'}, 401);
    if (user.email !== OWNER_EMAIL) return json({error: 'Owner administrator access is required.'}, 403);

    const profile = await firestoreAdminGet({env, collection: 'profiles', documentId: user.uid});
    if (profile?.role !== 'admin' || String(profile.email || '').toLowerCase() !== OWNER_EMAIL) {
      return json({error: 'Owner administrator access is required.'}, 403);
    }

    const [orders, jobs, checks] = await Promise.all([
      firestoreAdminQuery({env, collection: 'orders', limit: 25, orderBy: {field: 'created_at'}}),
      firestoreAdminQuery({env, collection: 'generation_jobs', limit: 50, orderBy: {field: 'created_at'}}),
      firestoreAdminQuery({env, collection: 'validator_checks', limit: 25, orderBy: {field: 'created_at'}})
    ]);
    const recentOrders = orders;
    const recentJobs = jobs;
    const recentChecks = checks;
    const paidOrders = recentOrders.filter(order => order.payment_status === 'paid');
    const completedJobs = recentJobs.filter(job => job.status === 'completed');
    const failedJobs = recentJobs.filter(job => job.status === 'failed');
    const totalTokens = completedJobs.reduce((sum, job) => sum + Number(job.usage?.total_tokens || 0), 0);
    const validatorTokens = recentChecks.reduce((sum, check) => sum + Number(check.result?.usage?.totalTokenCount || check.result?.usage?.total_tokens || 0), 0);
    const estimatedCost = completedJobs.reduce((sum, job) => sum + Number(job.usage?.estimated_cost_usd || 0), 0);

    return json({
      orders: recentOrders,
      jobs: recentJobs,
      checks: recentChecks,
      summary: {
        recent_paid_revenue: paidOrders.reduce((sum, order) => sum + Number(order.price || 0), 0),
        paid_orders: paidOrders.length,
        completed_generations: completedJobs.length,
        failed_generations: failedJobs.length,
        recorded_tokens: totalTokens,
        validator_reports: recentChecks.length,
        validator_tokens: validatorTokens,
        estimated_cost_usd: estimatedCost || null
      }
    });
  } catch (error) {
    console.error('CREOVATE admin monitoring load failed', error);
    return json({error: 'Business monitoring could not read the Firebase records. Check the Cloudflare Firebase service account and its Firestore access.'}, 503);
  }
}
