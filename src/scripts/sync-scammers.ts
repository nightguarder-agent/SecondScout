import PocketBase from 'pocketbase';
import { AntiScamService } from '../lib/server/scraper/anti_scam/AntiScamService';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function main() {
    const pbUrl = process.env.PUBLIC_POCKETBASE_URL || 'http://127.0.0.1:8090';
    console.log(`Connecting to PocketBase at ${pbUrl}...`);

    const pb = new PocketBase(pbUrl);

    // Turn off auto cancellation
    pb.autoCancellation(false);

    // Auth
    const email = process.env.PB_ADMIN_EMAIL;
    const password = process.env.PB_ADMIN_PASSWORD;

    if (email && password) {
        try {
            await pb.admins.authWithPassword(email, password);
            console.log('Admin authenticated successfully.');
        } catch (e) {
            console.error('Failed to authenticate as admin:', e);
            process.exit(1);
        }
    } else {
        console.warn('PB_ADMIN_EMAIL or PB_ADMIN_PASSWORD not set in .env. Proceeding without explicit admin auth (might fail if rules require it).');
    }

    const service = new AntiScamService(pb);
    console.log('Starting scammer sync...');
    await service.syncScammers(50); // Sync last 50 pages
    console.log('Sync finished.');
}

main().catch(console.error);
