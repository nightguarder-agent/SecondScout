import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';
import type { SearchResult, Scraper, SearchOptions } from '../../scraper';

export type BazosCategory = 'sport' | 'elektro' | 'auto' | 'reality' | 'pc' | 'mobil' | 'knihy' | 'deti' | 'zvierata' | 'nabytek';

export class BazosScraper implements Scraper {
    private readonly baseUrl = 'https://www.bazos.cz';
    private readonly maxRetries = 3;
    private readonly timeout = 10000; // 10 seconds

    private readonly negativeKeywords = [
        'kryt', 'obal', 'pouzdro', 'case', 'sklo', 'folie', 'fólie', 'glass',
        'krabice', 'box', 'nefunkční', 'na díly', 'broken', 'výměna', 'vyměním',
        'koupím', 'poptávka', 'servis', 'oprava'
    ];

    private isModelMismatch(title: string, query: string): boolean {
        const lowerTitle = title.toLowerCase();
        const lowerQuery = query.toLowerCase();

        const modifiers = ['max', 'plus', 'ultra', 'mini', 'pro'];
        
        for (const mod of modifiers) {
            const inQuery = lowerQuery.includes(mod);
            const inTitle = lowerTitle.includes(mod);
            
            if (inTitle && !inQuery) {
                if (mod === 'max' && lowerQuery.includes('pro') && !lowerQuery.includes('max')) return true;
                if (mod === 'plus' && !lowerQuery.includes('plus')) return true;
                if (mod === 'ultra' && !lowerQuery.includes('ultra')) return true;
                if (mod === 'mini' && !lowerQuery.includes('mini')) return true;
            }
            if (inQuery && !inTitle) return true;
        }
        return false;
    }

    private isNoise(title: string, price: number, query: string): boolean {
        const lowerTitle = title.toLowerCase();
        const lowerQuery = query.toLowerCase();

        if (this.isModelMismatch(title, query)) return true;

        const qTokens = lowerQuery.split(/\s+/).filter(t => t.length > 0);
        const versionTokens = qTokens.filter(t => /\d+/.test(t) || (t.length > 1 && /[m]\d+/i.test(t)));
        if (versionTokens.length > 0) {
            for (const vt of versionTokens) {
                if (!lowerTitle.includes(vt)) return true;
                const titleTokens = lowerTitle.split(/\s+/).filter(t => t.length > 0);
                const titleVersions = titleTokens.filter(t => 
                    (t !== vt) && (/\d+/.test(t) || (t.length > 1 && /[m]\d+/i.test(t)))
                );
                if (titleVersions.length > 0 && !lowerQuery.includes(titleVersions[0])) {
                    const isStorage = (t: string) => /gb|tb/i.test(t) || /^\d{2,4}$/.test(t);
                    if (!isStorage(titleVersions[0])) return true;
                }
            }
        }

        const hasNegative = this.negativeKeywords.some(word => 
            lowerTitle.includes(word) && !lowerQuery.includes(word)
        );
        if (hasNegative) return true;

        const globalNoise = ['výměna', 'vyměním', 'koupím', 'poptávka', 'hledám', 'sháním'];
        if (globalNoise.some(gn => lowerTitle.includes(gn) && !lowerQuery.includes(gn))) return true;

        return false;
    }

    private verifyStrictMatch(title: string, query: string): boolean {
        // Clean strings: lowercase, remove specialized chars (keep alphanumeric + utf8 chars)
        const clean = (s: string) => s.toLowerCase().replace(/[^\w\sěščřžýáíéúůďťň]/g, ' ').trim();

        const qTokens = clean(query).split(/\s+/).filter(t => t.length > 0);
        const titleCleaned = clean(title);

        // For short queries (< 4 words), we enforce that all query tokens exist somewhere in the title
        if (qTokens.length > 0 && qTokens.length < 4) {
            // Relaxed: Check if title contains each query token as a substring
            // This handles "iphone13" matching "iphone 13" and vice-versa
            const allFound = qTokens.every(qt => titleCleaned.includes(qt));
            if (!allFound) {
                return false;
            }
        }
        return true;
    }

    async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
        const maxPrice = options?.maxPrice;
        const category = options?.category as BazosCategory;
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

                // Fetch 2 pages in parallel (40 items total)
                const page1 = this.performSearch(query, options, 0);
                const page2 = this.performSearch(query, options, 20);

                const results = await Promise.all([page1, page2]);
                const allResults = results.flat();
                
                // Deduplicate by link (handles "Top" ads appearing on multiple pages)
                const uniqueResults = Array.from(
                    new Map(allResults.map(item => [item.link, item])).values()
                );
                
                return uniqueResults;
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

    private async performSearch(query: string, options?: SearchOptions, offset: number = 0): Promise<SearchResult[]> {
        const maxPrice = options?.maxPrice;
        const category = options?.category as BazosCategory;
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
                stranka: offset > 0 ? offset : undefined, // Bazos uses stranka as item offset
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

                // Noise Filtering
                if (options?.cleanSearch && this.isNoise(title, price, query)) return;

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
