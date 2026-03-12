import { pb, type Watcher } from './pocketbase';
import { searchMarket } from './scraper';

export async function processWatchers() {
    console.log('Starting watcher process...');

    try {
        // Fetch all watchers
        const records = await pb.collection('watchers').getFullList<Watcher>({
            sort: '-created',
        });

        const notifications: string[] = [];

        console.log(`Found ${records.length} watchers.`);

        for (const watcher of records) {
            console.log(`Checking watcher: ${watcher.keywords} (${watcher.region}) < ${watcher.max_price}`);

            const results = await searchMarket(watcher.region, watcher.keywords, watcher.max_price);

            // detailed sniper logic: check if any result is strictly below max_price
            const matches = results.filter(item => item.price <= watcher.max_price);

            if (matches.length > 0) {
                const msg = `Notification Triggered: Found ${matches.length} items for "${watcher.keywords}" in ${watcher.region} below ${watcher.max_price}`;
                console.log(msg);
                notifications.push(msg);
            }
        }

        return notifications;
    } catch (e) {
        console.log('Error processing watchers (Collection might not exist yet):', e);
        return ['Error: Could not run watchers. Ensure PocketBase is running and "watchers" collection exists.'];
    }
}
