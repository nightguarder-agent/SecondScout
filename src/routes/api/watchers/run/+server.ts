import { json } from '@sveltejs/kit';
import { processWatchers } from '$lib/server/watcher';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
    const logs = await processWatchers();
    return json({ logs });
};
