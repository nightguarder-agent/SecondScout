import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { processWatchers } from '$lib/server/watcher';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async ({ request }) => {
    // Basic security: require a matching Authorization header or CRON_SECRET query param
    // Vercel sends `Authorization: Bearer <CRON_SECRET>`
    const authHeader = request.headers.get('authorization');
    const url = new URL(request.url);
    const querySecret = url.searchParams.get('cron_secret');
    
    // Check against the expected CRON_SECRET environment variable
    const expectedSecret = env.CRON_SECRET;
    
    if (!expectedSecret) {
        console.error('CRON_SECRET environment variable is not configured');
        return json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    if (authHeader !== `Bearer ${expectedSecret}` && querySecret !== expectedSecret) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Running scheduled watcher check via API...`);

    let resultMsg = "";
    try {
        const notifications = await processWatchers();
        resultMsg += `Watcher check complete. ${notifications.length} notifications.\n`;

        // Add Anti-Scam sync
        try {
            const { pb } = await import('$lib/server/pocketbase');
            const { AntiScamService } = await import('$lib/server/scraper/anti_scam/AntiScamService');
            const antiScam = new AntiScamService(pb);
            await antiScam.syncScammers();
            resultMsg += `Anti-Scam sync complete.\n`;
        } catch (e) {
            console.error(`[${timestamp}] Anti-Scam sync failed:`, e);
            resultMsg += `Anti-Scam sync failed.\n`;
        }

        if (notifications.length > 0) {
            notifications.forEach((msg: string) => console.log(`  - ${msg}`));
        }

        return json({ success: true, message: resultMsg, timestamp });
    } catch (error) {
        console.error(`[${timestamp}] Error running watchers:`, error);
        return json({ error: 'Failed to process watchers' }, { status: 500 });
    }
};
