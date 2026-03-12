import { json } from '@sveltejs/kit';
import { pb, ensureAdmin } from '$lib/server/pocketbase';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const body = await request.json();
        const { keywords, region, max_price } = body;

        // Ensure we are authenticated
        await ensureAdmin();

        console.log(`[Watcher Create] Attempting to create watcher for: ${keywords} (${region})`);

        const record = await pb.collection('watchers').create({
            keywords,
            region,
            max_price,
            // user: "mvp_user" // Removed: Invalid relation ID causing 500 error
        });

        console.log(`[Watcher Create] Success: ${record.id}`);

        return json({ success: true });
    } catch (e) {
        console.error('Watcher Create Error:', e);
        return json({ error: 'Failed to create watcher' }, { status: 500 });
    }
};
