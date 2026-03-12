import type PocketBase from 'pocketbase';
import { PodvodyNaBazaruScraper } from './PodvodyNaBazaruScraper';

export class AntiScamService {
    private scraper: PodvodyNaBazaruScraper;
    private pb: PocketBase;
    private readonly COLLECTION = 'podvody';

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
                const existing = await this.pb.collection('podvody').getFirstListItem(`detailURL="${scammer.detailsURL}"`);

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

                await this.pb.collection('podvody').update(existing.id, updateData);
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
                    const record = await this.pb.collection('podvody').create(createData);
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
                    await this.pb.collection('scammers').getFirstListItem(`value="${value}" && podvody="${podvodId}"`);
                } catch (err: any) {
                    if (err.status === 404) {
                        // Create
                        await this.pb.collection('scammers').create({
                            value,
                            type,
                            podvody: podvodId
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
            const record = await this.pb.collection('scammers').getFirstListItem(`value="${url}" && type="url"`);
            return !!record;
        } catch {
            return false;
        }
    }
}
