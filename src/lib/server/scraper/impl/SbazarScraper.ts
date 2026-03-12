import * as cheerio from 'cheerio';
import type { SearchResult } from '../../scraper';

export class SbazarScraper {
    private readonly baseUrl = 'https://www.sbazar.cz';

    async search(query: string, maxPrice?: number): Promise<SearchResult[]> {
        try {
            const url = `${this.baseUrl}/hledej/${encodeURIComponent(query)}`;
            console.log(`[Sbazar] Fetching: ${url}`);

            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            if (!response.ok) {
                console.error(`[Sbazar] Request failed with status ${response.status} ${response.statusText}`);
                return [];
            }

            const html = await response.text();
            const $ = cheerio.load(html);
            const results: SearchResult[] = [];

            // Targeted selection based on browser research
            // We select the card container. The class list is complex, so we >> use a partial match or the container query class
            // Using a broader selector and filtering is safer.
            // .offer-card seems to be a reliable class for both ads and items
            $('.offer-card').each((_, element) => {
                const el = $(element);

                // --- 1. Ad Filtering ---

                // Check for Ad ID on the parent list item (often <li id="firstMoneyOffer-...">)
                const parentLi = el.closest('li');
                const parentId = parentLi.attr('id') || '';
                if (parentId.includes('MoneyOffer')) {
                    return; // Skip ads
                }

                // Check link for ad domains
                // The link is usually the direct parent <a> of the .offer-card, or inside it
                const anchor = el.closest('a').length ? el.closest('a') : el.find('a').first();
                const linkHref = anchor.attr('href') || '';

                if (linkHref.includes('c.seznam.cz') || linkHref.includes('ssp.seznam.cz')) {
                    return; // Skip ads like Sreality
                }

                // --- 2. Data Extraction ---

                // Title: Found in .text-red (sometimes) or more reliably checking the bold text or the text inside the main block
                // Based on research: <div class="text-red ...">Title</div>
                let title = el.find('.text-red').text().trim();

                // Fallback: finding the bold text which often contains the item name if .text-red fails or is "Rezervace"
                if (!title) {
                    title = el.find('b, strong').first().text().trim();
                }

                const fullLink = linkHref.startsWith('http') ? linkHref : `${this.baseUrl}${linkHref}`;

                // Price: look for bold tag or specific price classes
                let price = 0;
                // Often price is in a <b> tag or specific container
                const priceText = el.find('.text-neutral-black, b').text().trim();
                // Extract numbers
                const priceMatch = priceText.match(/([\d\s]+)\s*Kč/);
                if (priceMatch) {
                    price = parseInt(priceMatch[1].replace(/\s/g, ''));
                } else if (priceText.toLowerCase().includes('dohodou')) {
                    price = 0; // Negotiable
                }

                // Location
                const description = el.find('.text-dark-blue-50').text().trim();

                // Image
                const imgEl = el.find('img');
                let imageUrl = imgEl.attr('src');
                if (!imageUrl || imageUrl.includes('data:image')) {
                    imageUrl = imgEl.attr('data-src') || imgEl.attr('srcset')?.split(' ')[0];
                }

                if (title && fullLink !== '#') {
                    if (maxPrice && price > maxPrice) return;

                    results.push({
                        title,
                        price,
                        source: 'Sbazar.cz',
                        region: 'CZ',
                        link: fullLink,
                        description,
                        imageUrl
                    });
                }
            });

            return results;

        } catch (error) {
            console.error('Sbazar search failed:', error);
            return [];
        }
    }
}
