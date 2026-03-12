import { json } from '@sveltejs/kit';
import { searchMarket } from '$lib/server/scraper';

export async function GET({ url }) {
    const query = url.searchParams.get('q') || 'kolo';
    const region = (url.searchParams.get('region') as 'DE' | 'CZ') || 'CZ';

    try {
        console.log(`Testing scraper for ${region} with query: ${query}`);
        const results = await searchMarket(region, query);
        return json({ success: true, count: results.length, results });
    } catch (e: any) {
        console.error('Test scraper error:', e);
        return json({ success: false, error: e.message }, { status: 500 });
    }
}
