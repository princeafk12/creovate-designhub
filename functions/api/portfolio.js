import {firestoreAdminQuery, json} from '../_lib/firebase.js';

export async function onRequestGet({env}) {
  try {
    const items = await firestoreAdminQuery({
      env,
      collection: 'portfolio_items',
      where: [['published', true]],
      limit: 100,
      orderBy: {field: 'created_at'}
    });
    const published = items
      .filter(item => item.title && (item.image_id || item.image_url || item.image))
      .sort((left, right) => String(right.created_at || '').localeCompare(String(left.created_at || '')))
      .map(item => ({
        id: item.id,
        title: item.title,
        category: item.category || 'Other',
        image_url: item.image_id ? `/api/portfolio/image?id=${encodeURIComponent(item.image_id)}` : item.image_url || item.image
      }));
    return json({items: published}, 200, {'cache-control': 'public, max-age=60'});
  } catch (error) {
    console.error('CREOVATE public portfolio load failed', error);
    return json({error: 'Portfolio items could not be loaded.'}, 503);
  }
}
