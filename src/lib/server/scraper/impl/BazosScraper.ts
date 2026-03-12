import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';
import type { SearchResult } from '../../scraper';

export type BazosCategory = 'sport' | 'elektro' | 'auto' | 'reality' | 'pc' | 'mobil' | 'knihy' | 'deti' | 'zvierata' | 'nabytek';

export class BazosScraper {
    private readonly baseUrl = 'https://www.bazos.cz';
    private readonly maxRetries = 3;
    private readonly timeout = 10000; // 10 seconds

    private verifyStrictMatch(title: string, query: string): boolean {
        // Clean strings: lowercase, remove specialized chars (keep alphanumeric + utf8 chars)
        const clean = (s: string) => s.toLowerCase().replace(/[^\w\sěščřžýáíéúůďťň]/g, ' ').trim();

        const qTokens = clean(query).split(/\s+/).filter(t => t.length > 0);
        const titleTokens = clean(title).split(/\s+/);

        // For short queries (< 4 words), we enforce strict "AND" logic on the Title.
        // User searching "iPhone 15" expects an iPhone AND 15, not just 15 (Macbook).
        if (qTokens.length > 0 && qTokens.length < 4) {
            const allFound = qTokens.every(qt => titleTokens.includes(qt));
            if (!allFound) {
                // Try a softer check: substring match for tokens that might be joined?
                // e.g. "iphone15" match "iphone 15".
                // But titleTokens.includes(qt) covers exact token match.
                // Let's debug log:
                // console.log(`[Precision] Rejected "${title}" for "${query}" (Missing tokens)`);
                return false;
            }
        }
        return true;
    }

    async search(query: string, maxPrice?: number, category?: BazosCategory): Promise<SearchResult[]> {
        let lastError: Error | null = null;

        // Retry with exponential backoff
        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            try {
                if (attempt > 0) {
                    // Exponential backoff: 2s, 4s, 8s
                    const backoffDelay = Math.pow(2, attempt) * 1000;
                    console.log(`Retry attempt ${attempt + 1}/${this.maxRetries} after ${backoffDelay}ms`);
                    await new Promise(resolve => setTimeout(resolve, backoffDelay));
                }

                return await this.performSearch(query, maxPrice, category);
            } catch (error) {
                lastError = error as Error;

                // Check if it's a rate limiting error
                if (this.isRateLimitError(error)) {
                    console.warn(`Rate limited on attempt ${attempt + 1}. Retrying...`);
                    continue;
                }

                // Check if it's a timeout
                if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
                    console.warn(`Timeout on attempt ${attempt + 1}. Retrying...`);
                    continue;
                }

                // For other errors, don't retry
                console.error('Non-retryable error:', error);
                break;
            }
        }

        console.error(`Failed after ${this.maxRetries} attempts:`, lastError);
        return [];
    }

    private async performSearch(query: string, maxPrice?: number, category?: BazosCategory): Promise<SearchResult[]> {
        // Random delay to behave more like a human (1-3s)
        const delay = Math.floor(Math.random() * 2000) + 1000;
        await new Promise(resolve => setTimeout(resolve, delay));

        let searchUrl: string;
        let params: any;

        if (category) {
            // Category-specific search: https://sport.bazos.cz/inzeraty/{query}/
            searchUrl = `https://${category}.bazos.cz/inzeraty/${encodeURIComponent(query)}/`;
            params = {};
        } else {
            // Global search: https://www.bazos.cz/search.php?hledat={query}&rubriky=www
            searchUrl = `${this.baseUrl}/search.php`;
            params = {
                hledat: query,
                rubriky: 'www',
                hlokalita: '',
                humkreis: 25,
                cenaod: '',
                cenado: maxPrice ? maxPrice.toString() : '',
                Submit: 'Hledat',
                kitx: 'ano',
            };
        }

        // Perform request with timeout
        const response = await axios.get(searchUrl, {
            params,
            responseType: 'arraybuffer',
            timeout: this.timeout,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'cs-CZ,cs;q=0.9,en;q=0.8',
            }
        });

        // Check for rate limiting in response
        if (response.status === 429) {
            throw new Error('Rate limited (HTTP 429)');
        }

        // Bazos uses UTF-8 (confirmed by testing)
        const html = iconv.decode(Buffer.from(response.data), 'utf-8');

        // Check for rate limiting indicators in HTML
        if (html.includes('Too many requests') || html.includes('Příliš mnoho požadavků')) {
            throw new Error('Rate limited (detected in HTML)');
        }

        const $ = cheerio.load(html);
        const results: SearchResult[] = [];

        // Use .inzeraty.inzeratyflex blocks (divs)
        const items = $('.inzeraty.inzeratyflex');

        items.each((_, element) => {
            const el = $(element);

            const titleEl = el.find('.inzeratynadpis .nadpis a');
            const imgEl = el.find('.inzeratynadpis img.obrazek');
            const priceEl = el.find('.inzeratycena b');
            const descEl = el.find('.inzeratynadpis .popis');

            if (titleEl.length > 0) {
                const title = titleEl.text().trim();
                let link = titleEl.attr('href') || '#';

                // Ensure link is absolute
                if (link.startsWith('/')) {
                    link = `${this.baseUrl}${link}`;
                }

                const imageUrl = imgEl.attr('src');
                const description = descEl.text().trim().replace(/\s+/g, ' ');

                // Price parsing: "20 900 Kč"
                let price = 0;
                const priceText = priceEl.text().replace(/\s/g, '').replace(/Kč/i, '').replace(/,-/g, '');
                const parsedPrice = parseInt(priceText);
                if (!isNaN(parsedPrice)) {
                    price = parsedPrice;
                }

                if (maxPrice && price > maxPrice) return;

                // Precision Check: Title must contain all query tokens for short queries
                if (!this.verifyStrictMatch(title, query)) return;

                results.push({
                    title,
                    price,
                    source: category ? `Bazos.cz (${category})` : 'Bazos.cz',
                    region: 'CZ',
                    link,
                    description,
                    imageUrl
                });
            }
        });

        return results;
    }

    private isRateLimitError(error: any): boolean {
        if (axios.isAxiosError(error)) {
            // Check HTTP status
            if (error.response?.status === 429) {
                return true;
            }
            // Check error message
            if (error.message.includes('Rate limited')) {
                return true;
            }
        }
        return false;
    }
}
