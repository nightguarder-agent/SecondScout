import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

// Use environment variable or default to local Docker URL
const PB_URL = publicEnv.PUBLIC_POCKETBASE_URL || 'http://127.0.0.1:8090';

export const pb = new PocketBase(PB_URL);

// Disable auto-cancellation to allow multiple requests if needed
pb.autoCancellation(false);

// Helper to ensure we are authenticated as admin
export async function ensureAdmin() {
    if (pb.authStore.isValid && pb.authStore.isAdmin) return;

    if (env.PB_ADMIN_EMAIL && env.PB_ADMIN_PASSWORD) {
        try {
            await pb.admins.authWithPassword(env.PB_ADMIN_EMAIL, env.PB_ADMIN_PASSWORD);
            console.log('PocketBase Admin Auth Successful');
        } catch (err) {
            console.error('PocketBase Admin Auth Failed:', err);
            // Don't throw here, let the subsequent operation fail with a clear error if needed, 
            // but strictly speaking we should probably throw.
        }
    } else {
        console.warn('No Admin Credentials found in environment variables (PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD)');
    }
}

export interface Watcher {
    id: string;
    keywords: string;
    max_price: number;
    region: 'DE' | 'CZ';
    user?: string;
    created: string;
    updated: string;
}
