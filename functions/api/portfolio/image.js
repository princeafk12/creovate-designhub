import {firestoreAdminGet, json} from '../../_lib/firebase.js';

const validId = value => /^[A-Za-z0-9_-]{1,128}$/.test(value || '');

export async function onRequestGet({request, env}) {
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!validId(id)) return json({error: 'Portfolio image not found.'}, 404);
  try {
    const item = await firestoreAdminGet({env, collection: 'portfolio_items', documentId: id});
    if (!item?.published || item.image_id !== id) return json({error: 'Portfolio image not found.'}, 404);
    const image = await firestoreAdminGet({env, collection: 'portfolio_images', documentId: id});
    const match = String(image?.data_url || '').match(/^data:image\/(webp|png|jpeg);base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return json({error: 'Portfolio image not found.'}, 404);
    const bytes = Uint8Array.from(atob(match[2]), character => character.charCodeAt(0));
    const type = match[1] === 'jpeg' ? 'image/jpeg' : `image/${match[1]}`;
    return new Response(bytes, {headers: {
      'content-type': type,
      'cache-control': 'public, max-age=3600',
      'x-content-type-options': 'nosniff'
    }});
  } catch (error) {
    console.error('CREOVATE portfolio image load failed', error);
    return json({error: 'Portfolio image could not be loaded.'}, 503);
  }
}
