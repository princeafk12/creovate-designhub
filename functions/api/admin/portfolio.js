import {firebaseUser, firestoreAdminGet, firestoreAdminQuery, firestoreAdminCreate, json} from '../../_lib/firebase.js';

const OWNER_EMAIL = 'olanitealabij2023@gmail.com';
const categories = new Set(['Brand identity', 'Flyers & campaigns', 'Education', 'Digital products', 'Other']);
const validId = value => /^[A-Za-z0-9_-]{1,128}$/.test(value || '');

async function requireOwner(request, env) {
  const user = await firebaseUser(request, env);
  if (!user) return {response: json({error: 'Your administrator session has expired. Log in again.'}, 401)};
  if (user.email !== OWNER_EMAIL) return {response: json({error: 'Owner administrator access is required.'}, 403)};
  const profile = await firestoreAdminGet({env, collection: 'profiles', documentId: user.uid});
  if (profile?.role !== 'admin' || String(profile.email || '').toLowerCase() !== OWNER_EMAIL) {
    return {response: json({error: 'Owner administrator access is required.'}, 403)};
  }
  return {user};
}

export async function onRequestGet({request, env}) {
  try {
    const access = await requireOwner(request, env);
    if (access.response) return access.response;
    const items = await firestoreAdminQuery({env, collection: 'portfolio_items', limit: 250, orderBy: {field: 'created_at'}});
    items.sort((left, right) => String(right.created_at || '').localeCompare(String(left.created_at || '')));
    return json({items: items.map(item => ({
      ...item,
      image_url: item.image_id ? `/api/portfolio/image?id=${encodeURIComponent(item.image_id)}` : item.image_url || item.image || ''
    }))});
  } catch (error) {
    console.error('CREOVATE admin portfolio load failed', error);
    return json({error: 'Portfolio items could not be loaded. Check the Cloudflare Firebase service account.'}, 503);
  }
}

export async function onRequestPost({request, env}) {
  try {
    const access = await requireOwner(request, env);
    if (access.response) return access.response;
    const body = await request.json().catch(() => null);
    const title = String(body?.title || '').trim();
    const category = String(body?.category || 'Other');
    const dataUrl = String(body?.image_data || '');
    const match = dataUrl.match(/^data:image\/webp;base64,([A-Za-z0-9+/=]+)$/);
    if (!title || title.length > 100) return json({error: 'Enter a title of 1 to 100 characters.'}, 400);
    if (!categories.has(category)) return json({error: 'Choose a listed portfolio category.'}, 400);
    if (!match || dataUrl.length > 850_000) return json({error: 'Choose a valid image under 600 KB after compression.'}, 400);
    const imageBytes = atob(match[1]).length;
    if (!imageBytes || imageBytes > 600 * 1024) return json({error: 'Choose an image under 600 KB after compression.'}, 400);

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const imageResult = await firestoreAdminCreate({env, collection: 'portfolio_images', documentId: id, fields: {
      data_url: dataUrl,
      content_type: 'image/webp',
      created_at: createdAt
    }});
    if (!imageResult.created) return json({error: 'Could not reserve an image record. Please try again.'}, 503);
    const itemResult = await firestoreAdminCreate({env, collection: 'portfolio_items', documentId: id, fields: {
      id,
      title,
      category,
      image_id: id,
      published: true,
      created_at: createdAt,
      created_by: access.user.uid
    }});
    if (!itemResult.created) return json({error: 'The image was saved, but its portfolio entry could not be published. Please try again.'}, 503);
    return json({item: {id, title, category, image_id: id, image_url: `/api/portfolio/image?id=${encodeURIComponent(id)}`, published: true, created_at: createdAt}}, 201);
  } catch (error) {
    console.error('CREOVATE admin portfolio upload failed', error);
    return json({error: 'Portfolio upload failed. Check the Cloudflare Firebase service account and try again.'}, 503);
  }
}
