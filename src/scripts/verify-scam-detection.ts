import PocketBase from 'pocketbase';
import * as dotenv from 'dotenv';
import path from 'path';
import { AntiScamService } from '../lib/server/scraper/anti_scam/AntiScamService';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function main() {
    const pbUrl = process.env.PUBLIC_POCKETBASE_URL || 'http://127.0.0.1:8090';
    console.log(`Connecting to ${pbUrl}...`);
    const pb = new PocketBase(pbUrl);

    // Auth (Read-only should be enough for checking, but we use admin for consistency)
    try {
        await pb.admins.authWithPassword(process.env.PB_ADMIN_EMAIL!, process.env.PB_ADMIN_PASSWORD!);
    } catch (e) {
        console.error('Auth failed');
        return;
    }

    const service = new AntiScamService(pb);

    // Test cases
    const knownScamUrl = 'https://mobil.bazos.cz/inzerat/210863503/iphone-16-pink.php';
    const safeUrl = 'https://mobil.bazos.cz/inzerat/123456789/safe-listing.php';

    console.log(`\nTesting Known Scam URL: ${knownScamUrl}`);
    const isScam1 = await service.isScamUrl(knownScamUrl);
    console.log(`Result: ${isScam1} (Expected: true)`);

    console.log(`\nTesting Safe URL: ${safeUrl}`);
    const isScam2 = await service.isScamUrl(safeUrl);
    console.log(`Result: ${isScam2} (Expected: false)`);

    if (isScam1 && !isScam2) {
        console.log('\nSUCCESS: Scam detection logic verified.');
    } else {
        console.error('\nFAILURE: Scam detection logic incorrect.');
        process.exit(1);
    }
}

main();
