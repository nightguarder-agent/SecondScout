import type PocketBase from 'pocketbase';
import { PodvodyNaBazaruScraper } from './PodvodyNaBazaruScraper';
import { ensureAdmin } from '$lib/server/pocketbase';

export class AntiScamService {
    private scraper: PodvodyNaBazaruScraper;
    private pb: PocketBase;
    private readonly COLLECTION = 'scam_reports';

    constructor(pb: PocketBase) {
        this.scraper = new PodvodyNaBazaruScraper();
        this.pb = pb;
    }

    async syncScammers(pages: number = 3) {
        // Auth should be handled by the caller or passed in.

        const scammers = await this.scraper.scrapeNewest(pages);
        console.log(`[AntiScam] Found ${scammers.length} scam reports. Syncing to DB...`);

        let newReports = 0;
        let updatedReports = 0;
        let identifiersCreated = 0;

        for (const scammer of scammers) {
            if (scammer.platforms === 'Unknown') {
                continue;
            }

            let podvodId: string;

            try {
                // 1. Upsert 'podvody' record
                // Use detailsURL as unique key since scamId is not a built-in field and user says "id" is default
                // Assuming 'detailURL' is unique.
                const existing = await this.pb.collection('scam_reports').getFirstListItem(`detailURL="${scammer.detailsURL}"`);

                // Update
                const updateData = {
                    // scamId: scammer.scamId, // User didn't add scamId field? kept it out if not requested or add if they added it?
                    // User prompt did NOT list scamId in the `podvody` fields in the *latest* message, but listed it in previous.
                    // The latest message "items" example shows "id", "description", etc. NO "scamId".
                    // But "detailURL" is there. I will use what I have.
                    description: scammer.description,
                    platforms: scammer.platforms,
                    reportedAt: scammer.ReportedAt, // now ISO
                    reporterName: scammer.reporterName,
                    detailURL: scammer.detailsURL,
                    phones: scammer.phones,
                    emails: scammer.emails,
                    // bankAccounts: scammer.bankAccounts, // Removed as requested
                    urls: scammer.urls
                };

                await this.pb.collection('scam_reports').update(existing.id, updateData);
                podvodId = existing.id;
                updatedReports++;
            } catch (e: any) {
                if (e.status === 404) {
                    // Create
                    const createData = {
                        description: scammer.description,
                        platforms: scammer.platforms,
                        reportedAt: scammer.ReportedAt,
                        reporterName: scammer.reporterName,
                        detailURL: scammer.detailsURL,
                        phones: scammer.phones,
                        emails: scammer.emails,
                        // bankAccounts: scammer.bankAccounts, // Removed
                        urls: scammer.urls
                    };
                    const record = await this.pb.collection('scam_reports').create(createData);
                    podvodId = record.id;
                    newReports++;
                } else {
                    console.error(`[AntiScam] Error syncing report ${scammer.scamId}:`, e);
                    continue;
                }
            }

            // 2. Sync 'scammers' collection (identifiers)
            // We want to add identifiers linked to this podvodId.
            // We should check if they already exist FOR THIS podvodId to avoid duplicates?
            // Or just try create and ignore failure if unique index?
            // Assuming no unique index on value+podvody, we check first.

            // Helper to sync a type
            const syncIdentifier = async (value: string, type: 'phone' | 'email' | 'bankAccount' | 'url') => {
                try {
                    // Check if this specific value-podvody pair exists
                    // This assumes we want to capture that THIS scam report involves THIS number.
                    await this.pb.collection('scammers').getFirstListItem(`value="${value}" && scam_reports="${podvodId}"`);
                } catch (err: any) {
                    if (err.status === 404) {
                        // Create
                        await this.pb.collection('scammers').create({
                            value,
                            type,
                            scams: podvodId
                        });
                        identifiersCreated++;
                    }
                }
            };

            for (const phone of scammer.phones) await syncIdentifier(phone, 'phone');
            for (const email of scammer.emails) await syncIdentifier(email, 'email');
            // for (const acc of scammer.bankAccounts) await syncIdentifier(acc, 'bankAccount'); // Removed
            for (const url of scammer.urls) await syncIdentifier(url, 'url');
        }

        console.log(`[AntiScam] Sync complete. Reports: ${newReports} new, ${updatedReports} updated. Identifiers created: ${identifiersCreated}`);
    }

    /**
     * Checks if a given identifier (phone, email, account) is associated with a known scam.
     * @param identifier The string to search for
     */
    async isScammer(identifier: string): Promise<boolean> {
        if (!identifier) return false;
        try {
            await ensureAdmin();
            // Search in 'scammers' collection directly
            // We search for exact value match
            const record = await this.pb.collection('scammers').getFirstListItem(`value="${identifier}"`);
            return !!record;
        } catch {
            return false;
        }
    }

    async isScamUrl(url: string): Promise<boolean> {
        if (!url) return false;
        try {
            await ensureAdmin();
            const record = await this.pb.collection('scammers').getFirstListItem(`value="${url}" && type="url"`);
            return !!record;
        } catch {
            return false;
        }
    }

    async getScamUrls(urls: string[]): Promise<Set<string>> {
        if (!urls || urls.length === 0) return new Set();
        try {
            await ensureAdmin();
            // Reduce batch size to avoid long URL/filter issues in some environments
            const BATCH_SIZE = 20;
            const chunks = [];
            for (let i = 0; i < urls.length; i += BATCH_SIZE) {
                chunks.push(urls.slice(i, i + BATCH_SIZE));
            }

            const scamUrls = new Set<string>();
            for (const chunk of chunks) {
                try {
                    const filter = chunk.map(url => `value="${url}"`).join(' || ');
                    const fullFilter = `(${filter}) && type="url"`;
                    const records = await this.pb.collection('scammers').getFullList({
                        filter: fullFilter,
                        fields: 'value',
                        requestKey: null // Disable auto-cancel for this batch
                    });
                    records.forEach(r => scamUrls.add(r.value));
                } catch (innerError) {
                    console.error('[AntiScam] Batch chunk failed:', innerError);
                    // Continue with next chunk
                }
            }
            return scamUrls;
        } catch (e) {
            console.error('[AntiScam] Batch check failed:', e);
            return new Set();
        }
    }
}
