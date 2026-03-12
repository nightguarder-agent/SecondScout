
import axios from 'axios';
import * as cheerio from 'cheerio';
import type { SearchResult } from '../../scraper';

export class CyklobazarScraper {
    private readonly baseUrl = 'https://www.cyklobazar.cz';

    /**
     * Verifies if the found item title is relevant to the search query.
     * Uses strict token matching for short queries to avoid partial matches (e.g. "lístky" -> "pístky").
     */
    private verifyRelevance(title: string, query: string): boolean {
        // clean strings: lowercase, remove special chars except spaces/alphanumeric
        const clean = (s: string) => s.toLowerCase().replace(/[^\w\sěščřžýáíéúůďťň]/g, '').trim();

        const qTokens = clean(query).split(/\s+/).filter(t => t.length > 1);
        const titleTokens = clean(title).split(/\s+/);

        // For short queries (< 4 words), require strict word overlap
        // This prevents "lístky" matching "pístky" just because they share a substring or fuzzy match
        if (qTokens.length < 4) {
            const hasOverlap = qTokens.some(qt => titleTokens.includes(qt));
            if (!hasOverlap) {
                // Double check: if query is a single word and it's NOT in title tokens, reject.
                // This is the core fix for lístky vs pístky.
                console.log(`[Relevance] Rejected "${title}" for query "${query}" (No token overlap)`);
                return false;
            }
        }

        return true;
    }

    async search(query: string, maxPrice?: number): Promise<SearchResult[]> {
        const queryLower = query.toLowerCase();

        try {
            // Correct Search URL found via OpenSearch: https://www.cyklobazar.cz/vsechny-kategorie?q={query}
            const searchUrl = `${this.baseUrl}/vsechny-kategorie?q=${encodeURIComponent(query)}`;
            console.log(`Fetching ${searchUrl}`);

            const response = await axios.get(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'cs-CZ,cs;q=0.9,en;q=0.8',
                }
            });

            const $ = cheerio.load(response.data);
            const results: SearchResult[] = [];

            // Selector found via inspection: .cb-offer-list__item
            const items = $('.cb-offer-list__item');
            console.log(`Found ${items.length} items`);

            // Use arrow function to preserve 'this' context for verifyRelevance
            items.each((_, element) => {
                const el = $(element);

                // Title is usually in h2/h3/h4 or .title class
                const titleEl = el.find('h2, h3, h4').first();
                const linkEl = el.find('a').first();
                const imgEl = el.find('img').first();

                // Price selector based on inspection
                const priceEl = el.find('.price, .cb-offer__price');

                if (titleEl.length > 0) {
                    const title = titleEl.text().trim();
                    let link = linkEl.attr('href') || '#';
                    if (link.startsWith('/')) {
                        link = `${this.baseUrl}${link}`;
                    }

                    const imageUrl = imgEl.attr('src') || imgEl.attr('data-src');

                    let price = 0;
                    const priceText = priceEl.text().replace(/\s/g, '').replace(/Kč/i, '').replace(/,-/g, '');
                    const parsedPrice = parseInt(priceText);
                    if (!isNaN(parsedPrice)) {
                        price = parsedPrice;
                    }

                    // Apply client-side filtering
                    if (maxPrice && price > maxPrice) return;

                    // Verify relevance using the class method
                    if (!this.verifyRelevance(title, query)) return;

                    results.push({
                        title,
                        price,
                        source: 'Cyklobazar.cz',
                        region: 'CZ',
                        link,
                        description: title,
                        imageUrl: imageUrl?.startsWith('/') ? `${this.baseUrl}${imageUrl}` : imageUrl
                    });
                }
            });

            return results;

        } catch (error) {
            console.error('Cyklobazar search failed:', error);
            // Return empty list on error
            return [];
        }
    }
}
