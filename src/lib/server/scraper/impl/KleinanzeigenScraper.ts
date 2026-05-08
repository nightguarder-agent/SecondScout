import axios from 'axios';
import * as cheerio from 'cheerio';
import type { SearchResult, Scraper, SearchOptions } from '../../scraper';

export class KleinanzeigenScraper implements Scraper {
    private readonly baseUrl = 'https://www.kleinanzeigen.de';

    private readonly negativeKeywords = [
        'ersatzteile', 'defekt', 'kaputt', 'gebraucht', 'reparatur',
        'tausch', 'suche', 'gesucht', 'kaufe', 'für teile',
        'nicht funktionsfähig', 'defekte', 'schrott', 'bastler'
    ];

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

    private isModelMismatch(title: string, query: string): boolean {
        const lowerTitle = title.toLowerCase();
        const lowerQuery = query.toLowerCase();

        const modifiers = ['max', 'plus', 'ultra', 'mini', 'pro', 'pro max'];
        
        for (const mod of modifiers) {
            if (lowerQuery.includes(mod) !== lowerTitle.includes(mod)) {
                return true;
            }
        }

        return false;
    }

    private isNoise(title: string, price: number, query: string, options?: SearchOptions): boolean {
        const lowerTitle = title.toLowerCase();
        const lowerQuery = query.toLowerCase();

        if (this.isModelMismatch(title, query)) return true;

        // User-provided negative keywords
        if (options?.negativeKeywords && options.negativeKeywords.length > 0) {
            if (options.negativeKeywords.some(nk => lowerTitle.includes(nk))) {
                return true;
            }
        }

        const qTokens = this.tokenize(lowerQuery);
        const titleTokens = this.tokenize(lowerTitle);
        
        // Check version numbers match
        const versionTokens = qTokens.filter(t => /\d+/.test(t) || /[m]\d+/.test(t));
        if (versionTokens.length > 0) {
            for (const vt of versionTokens) {
                if (!titleTokens.some(tToken => tToken.includes(vt))) return true;
            }
        }

        // Check for negative keywords
        const hasNegative = this.negativeKeywords.some(word => 
            lowerTitle.includes(word) && !lowerQuery.includes(word)
        );
        if (hasNegative) return true;

        // Wanted ads
        const globalNoise = ['suche', 'gesucht', 'kaufe', 'tausche', 'für tausch'];
        if (globalNoise.some(gn => lowerTitle.includes(gn) && !lowerQuery.includes(gn))) return true;

        return false;
    }

    private verifyStrictMatch(title: string, query: string, options?: SearchOptions): boolean {
        const clean = (s: string) => s.toLowerCase().replace(/[^\w\säöüß]/g, ' ').trim();
        const qTokens = this.tokenize(clean(query));
        const titleTokens = this.tokenize(clean(title));

        if (qTokens.length > 0 && qTokens.length < 4) {
            return this.hasAllTokens(titleTokens, qTokens);
        }
        return true;
    }

    async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
        const maxPrice = options?.maxPrice;
        const region = options?.category; // Used for regional filtering in DE

        try {
            // Kleinanzeigen search URL format: /s-{query}/k0
            // With location: /s-{query}/l{zipcode} (e.g., l33719 for Munich)
            let searchUrl = `${this.baseUrl}/s-${encodeURIComponent(query)}/k0`;
            
            // Add price filter if specified
            const params: any = {};
            if (maxPrice) {
                params.price = `:${maxPrice}`;
            }

            // Add location filter if provided (German ZIP codes are 5 digits)
            if (region && /^\d{5}$/.test(region)) {
                searchUrl = `${this.baseUrl}/s-${encodeURIComponent(query)}/l${region}`;
            }

            console.log(`[Kleinanzeigen] Fetching: ${searchUrl}`);

            const response = await axios.get(searchUrl, {
                params,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
                    'Accept-Encoding': 'gzip, deflate, br'
                },
                timeout: 15000,
                maxRedirects: 5
            });

            const $ = cheerio.load(response.data);
            const results: SearchResult[] = [];

            // Kleinanzeigen uses article elements with data-ad-id attribute
            // Main ad container: .aditem (or article.aditem)
            const items = $('article.aditem, .aditem');

            console.log(`[Kleinanzeigen] Found ${items.length} items`);

            items.each((_, element) => {
                const el = $(element);
                
                // Title: h2 element with class 'text-module-begin' or within .aditem-main
                const titleEl = el.find('h2').first() || el.find('.text-module-begin a').first();
                const linkEl = titleEl.find('a').first();
                
                // If no link in title, try to find it elsewhere
                const directLink = el.find('a[href*="/s-anzeige/"]').first();
                
                const title = titleEl.text().trim() || el.find('.text-module-begin').text().trim();
                let link = linkEl.attr('href') || directLink.attr('href') || '';
                
                if (link && !link.startsWith('http')) {
                    link = `${this.baseUrl}${link}`;
                }

                // Price: .aditem-main--middle--price or .price
                const priceEl = el.find('.aditem-main--middle--price, .price').first();
                let price = 0;
                const priceText = priceEl.text().trim()
                    .replace(/\s/g, '')
                    .replace(/€/g, '')
                    .replace(/\./g, '')
                    .replace(/,/g, '.');
                const parsedPrice = parseFloat(priceText);
                if (!isNaN(parsedPrice)) {
                    price = Math.round(parsedPrice);
                }

                // Image
                const imgEl = el.find('img').first();
                let imageUrl = imgEl.attr('src') || imgEl.attr('data-src') || '';
                if (imageUrl && !imageUrl.startsWith('http')) {
                    imageUrl = imageUrl.startsWith('//') ? `https:${imageUrl}` : `${this.baseUrl}${imageUrl}`;
                }

                // Location: .aditem-main--top--left or .location
                const locationEl = el.find('.aditem-main--top--left, .location').first();
                const location = locationEl.text().trim();

                if (!title || !link) return;

                if (maxPrice && price > maxPrice) return;

                // Strict match verification
                if (!this.verifyStrictMatch(title, query, options)) return;

                // Noise filtering
                if (options?.cleanSearch && this.isNoise(title, price, query, options)) return;

                results.push({
                    title,
                    price,
                    source: 'Kleinanzeigen.de',
                    region: 'DE',
                    link,
                    description: location || 'Germany',
                    imageUrl
                });
            });

            return results.sort((a, b) => a.price - b.price);

        } catch (error) {
            console.error('[Kleinanzeigen] Search failed:', error);
            return [];
        }
    }
}
