import axios from 'axios';
import * as cheerio from 'cheerio';
import type { SearchResult } from '../../scraper';

export class AukroScraper {
    private readonly baseUrl = 'https://aukro.cz';

    private tokenize(text: string): string[] {
        const lower = text.toLowerCase().trim();
        return lower
            .replace(/[-_]/g, ' ')
            .split(/\s+/)
            .filter(token => token.length > 0)
            .map(token => {
                if (/^m\d+$/.test(token)) return token.toLowerCase();
                if (/^\d{2,4}$/.test(token)) return token;
                if (/^\d+$/.test(token.replace(/[^0-9]/g, ''))) return token.replace(/[^0-9]/g, '');
                return token;
            });
    }

    private hasAllTokens(titleTokens: string[], queryTokens: string[]): boolean {
        return queryTokens.every(qToken => 
            titleTokens.some(tToken => 
                tToken.includes(qToken) || qToken.includes(tToken)
            )
        );
    }

    private verifyStrictMatch(title: string, query: string): boolean {
        const clean = (s: string) => s.toLowerCase().replace(/[^\w\sěščřžýáíéúůďťň]/g, ' ').trim();
        const qTokens = this.tokenize(clean(query));
        const titleTokens = this.tokenize(clean(title));

        if (qTokens.length > 0 && qTokens.length < 4) {
            return this.hasAllTokens(titleTokens, qTokens);
        }
        return true;
    }

    async search(query: string, maxPrice?: number): Promise<SearchResult[]> {
        try {
            // Aukro results: https://aukro.cz/vysledky-vyhledavani?text={query}
            // Price filter if possible, otherwise manual. 
            // Query param: 'text'
            // Price limit: 'price_limit_to' (check if valid)

            const params: any = {
                text: query,
                size: 60 // items per page
            };

            // Build URL manually
            const searchUrl = `${this.baseUrl}/vysledky-vyhledavani?text=${encodeURIComponent(query)}${maxPrice ? `&price_to=${maxPrice}` : ''}`;

            console.log(`[Aukro] Fetching: ${searchUrl}`);
            const response = await axios.get(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
                }
            });

            const $ = cheerio.load(response.data);
            const results: SearchResult[] = [];

            // Aukro structure changes often. 
            // Usually uses standard list items. 
            // Look for article or div with product info.

            // Common container for legacy/standard view: .list-page-item or .card-item

            // Try generic product card
            const items = $('.item-card');
            console.log(`[Aukro] Found ${items.length} items with selector .item-card`);

            items.each((_, element) => {
                const el = $(element);
                const titleEl = el.find('h2');
                const priceEl = el.find('auk-item-card-price');
                const imgEl = el.find('img');
                const link = el.attr('href');

                if (titleEl.length > 0 && link) {
                    const title = titleEl.text().trim();
                    const fullLink = link.startsWith('http') ? link : `${this.baseUrl}${link}`;

                    // Price extraction from <auk-item-card-price>
                    let price = 0;
                    const priceText = priceEl.text().trim();
                    const parsedPrice = parseInt(priceText.replace(/\s/g, '').replace(/Kč/i, '').replace(/,/g, '.').replace(/\./g, ''));
                    if (!isNaN(parsedPrice)) {
                        price = parsedPrice;
                    }

                    if (maxPrice && price > maxPrice) return;

                    // Strict relevance check - title must contain all query tokens
                    if (!this.verifyStrictMatch(title, query)) return;

                    let imageUrl = imgEl.attr('data-src') || imgEl.attr('src');
                    if (imageUrl && !imageUrl.startsWith('http')) {
                        imageUrl = (imageUrl.startsWith('//') ? 'https:' : 'https://') + imageUrl;
                    }

                    results.push({
                        title,
                        price,
                        source: 'Aukro.cz',
                        region: 'CZ',
                        link: fullLink,
                        description: 'Aukro listing',
                        imageUrl
                    });
                }
            });

            return results;

        } catch (error) {
            console.error('Aukro search failed (likely bot protection):', error);
            // Don't throw, just return empty to not break other scrapers
            return [];
        }
    }
}
