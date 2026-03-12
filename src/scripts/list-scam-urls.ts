import PocketBase from 'pocketbase';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function main() {
    const pbUrl = process.env.PUBLIC_POCKETBASE_URL || 'http://127.0.0.1:8090';
    const pb = new PocketBase(pbUrl);

    try {
        await pb.admins.authWithPassword(process.env.PB_ADMIN_EMAIL!, process.env.PB_ADMIN_PASSWORD!);
    } catch (e) {
        console.error('Auth failed');
        return;
    }

    try {
        // Fetch scam records that are URLs
        const list = await pb.collection('scammers').getList(1, 10, {
            filter: 'type="url"',
            sort: '-created'
        });

        console.log(`Found ${list.totalItems} scam URLs in DB.`);
        if (list.items.length === 0) {
            console.log("No URLs found. We cannot test URL detection.");
            return;
        }

        console.log("\n--- Known Scam URLs ---");
        list.items.forEach(item => {
            console.log(`- ${item.value} (Podvod ID: ${item.podvody})`);
        });

    } catch (e) {
        console.error(e);
    }
}

main();
