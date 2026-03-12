import { json } from '@sveltejs/kit';
import { searchMarket } from '$lib/server/scraper';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
    const region = url.searchParams.get('region') as 'DE' | 'CZ';
    const q = url.searchParams.get('q');
    const maxPrice = url.searchParams.get('maxPrice');

    if (!region || !q) {
        return json({ error: 'Missing region or query' }, { status: 400 });
    }

    const price = maxPrice ? parseFloat(maxPrice) : undefined;
    const sources = url.searchParams.get('sources')?.split(',').filter(s => s.length > 0);

    // Note: category is currently unused/undefined in the simplified API
    const results = await searchMarket(region, q, price, undefined, sources);

    return json(results);
};
