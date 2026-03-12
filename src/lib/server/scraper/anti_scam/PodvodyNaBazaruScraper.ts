import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ScammerInfo {
    scamId: string;
    description: string;
    phones: string[];
    emails: string[];
    bankAccounts: string[];
    urls: string[];
    platforms: 'Bazos' | 'Sbazar' | 'Facebook' | 'Unknown';
    ReportedAt: string;
    reporterName: string;
    detailsURL: string;
}

export class PodvodyNaBazaruScraper {
    private readonly BASE_URL = 'https://podvodnabazaru.cz';

    private cfDecodeEmail(encodedString: string): string {
        let email = "";
        const r = parseInt(encodedString.substr(0, 2), 16);
        for (let n = 2; n < encodedString.length; n += 2) {
            const c = parseInt(encodedString.substr(n, 2), 16) ^ r;
            email += String.fromCharCode(c);
        }
        return email;
    }

    async scrapePage(page: number = 1): Promise<ScammerInfo[]> {
        try {
            const url = `${this.BASE_URL}/?page=${page}`;
            console.log(`Scraping ${url}...`);
            const { data } = await axios.get(url);
            const $ = cheerio.load(data);
            const scammers: ScammerInfo[] = [];

            // Select all post containers
            const posts = $('.card').has('.card-header');

            posts.each((_, element) => {
                const card = $(element);

                // Header extraction
                const headerText = card.find('.card-header').text();
                const scamIdMatch = headerText.match(/Číslo podvodu:\s*(\d+)/i);
                const reporterMatch = headerText.match(/vložil\(a\):\s*([^\n\r]+?)(?=\s+dne:|$)/i);
                const dateMatch = headerText.match(/dne:\s*([\d\.\s]+)/i); // Moved validation down
                const rawDate = dateMatch ? dateMatch[1].trim() : ''; // e.g. "26. 12. 2025" or "26. 12. 2025."

                const scamId = scamIdMatch ? scamIdMatch[1].trim() : '';
                const reporterName = reporterMatch ? reporterMatch[1].trim() : '';
                const detailsURL = scamId ? `${this.BASE_URL}/podvod/${scamId}` : '';

                let ReportedAt = '';
                if (rawDate) {
                    // Remove trailing dot if present
                    const cleanDate = rawDate.replace(/\.$/, '');
                    const parts = cleanDate.split('.').map(s => s.trim()).filter(p => p.length > 0);

                    if (parts.length === 3) {
                        const day = parts[0].padStart(2, '0');
                        const month = parts[1].padStart(2, '0');
                        const year = parts[2];
                        // ISO format for PocketBase: YYYY-MM-DD HH:MM:SS.123Z
                        ReportedAt = `${year}-${month}-${day} 10:00:00.000Z`;
                    } else {
                        console.warn(`[Scraper] Failed to parse date: "${rawDate}" (Id: ${scamId})`);
                    }
                }

                if (!scamId) return; // Skip if main ID is missing

                // Body extraction
                const phones: string[] = [];
                const emails: string[] = [];
                // const bankAccounts: string[] = []; // User requested to ignore bank accounts
                const urls: string[] = [];
                let description = '';

                // Iterate over rows in the body to find structured fields
                card.find('.card-body .row').children().each((i, col) => {
                    const $col = $(col);

                    // Fields usually come in pairs: Label (col-md-2) -> Value (col-md-10)
                    // But here we might just iterate and check text content if structure varies,
                    // or strictly follow the label->value pattern.
                    // Based on research: <div class="col-md-2 main-text">Label:</div> <div class="col-md-10">Value</div>

                    if ($col.hasClass('col-md-2') && $col.hasClass('main-text')) {
                        const label = $col.text().trim().toLowerCase();
                        const $valueCol = $col.next('.col-md-10');

                        // Check for Cloudflare email protection
                        let value = $valueCol.text().trim();
                        const cfEmail = $valueCol.find('.__cf_email__');
                        if (cfEmail.length > 0) {
                            const encoded = cfEmail.attr('data-cfemail');
                            if (encoded) {
                                value = this.cfDecodeEmail(encoded);
                            }
                        }

                        if (label.includes('telefon')) {
                            // Clean phone number
                            phones.push(value.replace(/\s+/g, ''));
                        } else if (label.includes('mail') || label.includes('email')) {
                            emails.push(value);
                        } else if (label.includes('url') || label.includes('web')) {
                            urls.push(value);
                        }
                    }

                    // Description is usually in a full-width col at the end
                    if ($col.hasClass('col-md-12') && $col.hasClass('mt-2')) {
                        description = $col.text().trim();
                    }
                });

                // Extract emails/phones from description as fallback or addition
                // Simple email regex
                const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
                const descEmails = description.match(emailRegex);
                if (descEmails) {
                    descEmails.forEach(e => {
                        if (!emails.includes(e)) emails.push(e);
                    });
                }

                // Simple phone extraction from description could be risky (false positives),
                // but usually +420... is safe.
                const phoneRegex = /(?:\+420)?\s*\d{3}\s*\d{3}\s*\d{3}/g;
                const descPhones = description.match(phoneRegex);
                if (descPhones) {
                    descPhones.forEach(p => {
                        const clean = p.replace(/\s+/g, '');
                        if (!phones.includes(clean)) phones.push(clean);
                    });
                }

                // Determine platform
                let platforms: ScammerInfo['platforms'] = 'Unknown';
                const lowerDesc = description.toLowerCase();
                const combinedUrls = urls.join(' ').toLowerCase();

                if (combinedUrls.includes('bazos.cz') || lowerDesc.includes('bazos')) {
                    platforms = 'Bazos';
                } else if (combinedUrls.includes('sbazar.cz') || lowerDesc.includes('sbazar')) {
                    platforms = 'Sbazar';
                } else if (combinedUrls.includes('facebook') || lowerDesc.includes('facebook') || lowerDesc.includes('fb marketplace')) {
                    platforms = 'Facebook';
                }

                // Filter out Facebook immediately if requested?
                // User said: "ok lets ignore facebook posts for now."
                if (platforms === 'Facebook') return;

                // Also skip if no contact info at all?
                // User said: "If a podvody has no email or phone mentioned... we don't need to store them."
                // Except URLs are also useful identifiers.
                if (phones.length === 0 && emails.length === 0 && urls.length === 0) return;

                scammers.push({
                    scamId,
                    description,
                    phones,
                    emails,
                    bankAccounts: [], // Empty as requested
                    urls,
                    platforms,
                    ReportedAt,
                    reporterName,
                    detailsURL
                });
            });

            return scammers;
        } catch (error) {
            console.error(`Error scraping page ${page}:`, error);
            return [];
        }
    }

    async scrapeNewest(maxPages: number = 3): Promise<ScammerInfo[]> {
        const allScammers: ScammerInfo[] = [];
        for (let i = 1; i <= maxPages; i++) {
            const pageScammers = await this.scrapePage(i);
            if (pageScammers.length === 0) break;
            allScammers.push(...pageScammers);
            // Be nice to the server
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        return allScammers;
    }
}
