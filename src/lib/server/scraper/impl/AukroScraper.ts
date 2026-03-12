import axios from 'axios';
import * as cheerio from 'cheerio';
import type { SearchResult } from '../../scraper';

export class AukroScraper {
    private readonly baseUrl = 'https://aukro.cz';

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
            const items = $('article.list-card');
            console.log(`[Aukro] Found ${items.length} items with selector article.list-card`);

            items.each((_, element) => {
                const el = $(element);

                const titleEl = el.find('h2.list-card-title');
                const linkEl = el.find('a.list-card-link'); // often the whole card or title
                const priceEl = el.find('.list-card-price-amount');
                const imgEl = el.find('.list-card-img img');

                if (titleEl.length > 0) {
                    const title = titleEl.text().trim();
                    const link = linkEl.attr('href');
                    const fullLink = link ? (link.startsWith('http') ? link : `${this.baseUrl}${link}`) : '#';

                    // Price "1 200 Kč"
                    let price = 0;
                    const priceText = priceEl.text().trim().replace(/\s/g, '').replace(/Kč/i, '').replace(/,/g, '.'); // Handle "1,200" potentially? or "1 200"
                    const parsedPrice = parseInt(priceText.replace(/\./g, '').replace(/\s/g, ''));
                    if (!isNaN(parsedPrice)) {
                        price = parsedPrice;
                    }

                    if (maxPrice && price > maxPrice) return;

                    const imageUrl = imgEl.attr('src');

                    results.push({
                        title,
                        price,
                        source: 'Aukro.cz (Experimental)',
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
