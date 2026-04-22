import axios from 'axios';
import * as cheerio from 'cheerio';
import type { SearchResult, Scraper, SearchOptions } from '../../scraper';

export class SbazarScraper implements Scraper {
    private readonly baseUrl = 'https://www.sbazar.cz';

    private readonly negativeKeywords = [
        'kryt', 'obal', 'pouzdro', 'case', 'sklo', 'folie', 'fólie', 'glass',
        'krabice', 'box', 'nefunkční', 'na díly', 'broken', 'výměna', 'vyměním',
        'koupím', 'poptávka', 'servis', 'oprava'
    ];

    private isModelMismatch(title: string, query: string): boolean {
        const lowerTitle = title.toLowerCase();
        const lowerQuery = query.toLowerCase();

        // Model modifiers to check
        const modifiers = ['max', 'plus', 'ultra', 'mini', 'pro'];
        
        for (const mod of modifiers) {
            const inQuery = lowerQuery.includes(mod);
            const inTitle = lowerTitle.includes(mod);
            
            // If modifier is in title but NOT in query (e.g., query "Pro", title "Pro Max")
            if (inTitle && !inQuery) {
                // Special case for iPhone: "Pro Max" contains "Pro"
                if (mod === 'max' && lowerQuery.includes('pro') && !lowerQuery.includes('max')) return true;
                if (mod === 'plus' && !lowerQuery.includes('plus')) return true;
                if (mod === 'ultra' && !lowerQuery.includes('ultra')) return true;
                if (mod === 'mini' && !lowerQuery.includes('mini')) return true;
            }
            
            // If modifier is in query but NOT in title (e.g., query "Pro", title just "iPhone 15")
            if (inQuery && !inTitle) return true;
        }

        return false;
    }

    private isNoise(title: string, price: number, query: string): boolean {
        const lowerTitle = title.toLowerCase();
        const lowerQuery = query.toLowerCase();

        // 0. Model mismatch check (Strict Model Matching)
        if (this.isModelMismatch(title, query)) return true;

        // 1. Mandatory Tokens: If query has numbers (e.g., "15", "M2"), title MUST contain them.
        const qTokens = lowerQuery.split(/\s+/).filter(t => t.length > 0);
        const versionTokens = qTokens.filter(t => /\d+/.test(t) || (t.length > 1 && /[m]\d+/i.test(t)));
        
        if (versionTokens.length > 0) {
            for (const vt of versionTokens) {
                if (!lowerTitle.includes(vt)) return true;
                
                // If query is "iPhone 15", but title has "iPhone 13" or "iPhone 14"
                // We check if the title has a DIFFERENT number that looks like a version.
                const titleTokens = lowerTitle.split(/\s+/).filter(t => t.length > 0);
                const titleVersions = titleTokens.filter(t => 
                    (t !== vt) && (/\d+/.test(t) || (t.length > 1 && /[m]\d+/i.test(t)))
                );
                
                // If title has a different version number, it's likely a mismatch
                if (titleVersions.length > 0 && !lowerQuery.includes(titleVersions[0])) {
                    // But allow if title has multiple numbers (e.g. "iPhone 15 128GB")
                    const isStorage = (t: string) => /gb|tb/i.test(t) || /^\d{2,4}$/.test(t);
                    if (!isStorage(titleVersions[0])) return true;
                }
            }
        }

        // 2. Keyword check: If title contains negative keyword NOT in query
        const hasNegative = this.negativeKeywords.some(word => 
            lowerTitle.includes(word) && !lowerQuery.includes(word)
        );

        if (hasNegative) {
            // Strict enforcement: if it contains generic noise, it's out.
            return true;
        }

        // 3. Trade/Wanted Ads (Global Noise)
        const globalNoise = ['výměna', 'vyměním', 'koupím', 'poptávka', 'hledám', 'sháním'];
        if (globalNoise.some(gn => lowerTitle.includes(gn) && !lowerQuery.includes(gn))) {
            return true;
        }

        return false;
    }

    async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
        const maxPrice = options?.maxPrice;
        try {
            const url = `${this.baseUrl}/hledej/${encodeURIComponent(query)}`;
            console.log(`[Sbazar] Fetching: ${url}`);

            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                },
                timeout: 10000,
                maxRedirects: 5,
            });

            const html = response.data;
            
            // Debug: check if we got actual content or a challenge page
            if (html.includes('id="challenge-running"')) {
                console.error('[Sbazar] Cloudflare/Seznam challenge detected');
                return [];
            }

            const $ = cheerio.load(html);
            
            // Astro serializes data into component props. 
            // The SearchPageList component contains the actual listings.
            const island = $('astro-island[component-export="SearchPageList"]').first();
            const propsStr = island.attr('props');

            if (!propsStr) {
                console.warn(`[Sbazar] SearchPageList island or props not found. HTML length: ${html.length}`);
                return [];
            }

            // Decode and parse props
            const decodedProps = propsStr.replace(/&quot;/g, '"')
                                         .replace(/&amp;/g, '&')
                                         .replace(/&lt;/g, '<')
                                         .replace(/&gt;/g, '>');
            
            const props = JSON.parse(decodedProps);

            // Unwrapping helper for Seznam/Astro serialization format: [0, value] or [1, [items]]
            const unwrap = (val: any): any => {
                if (Array.isArray(val)) {
                    // Seznam format: [type, value]
                    // type 0: primitive/object, type 1: array, type 2: Map?, etc.
                    if (val.length === 2 && (val[0] === 0 || val[0] === 1)) {
                        return unwrap(val[1]);
                    }
                    return val.map(unwrap);
                }
                if (typeof val === 'object' && val !== null) {
                    const res: any = {};
                    for (const key in val) {
                        res[key] = unwrap(val[key]);
                    }
                    return res;
                }
                return val;
            };

            const data = unwrap(props);
            
            // Recursively find the listings array
            let offers: any[] = [];
            
            const findOffers = (obj: any) => {
                if (!obj || typeof obj !== 'object') return;
                
                // Check if this object has an array that looks like listings
                const keys = ['offers', 'results', 'items'];
                for (const key of keys) {
                    if (Array.isArray(obj[key]) && obj[key].length > 0) {
                        const first = obj[key][0];
                        if (first && typeof first === 'object' && (first.name || first.id || first.title)) {
                            offers = obj[key];
                            return;
                        }
                    }
                }

                // If it's an array, check its items
                if (Array.isArray(obj)) {
                    for (const item of obj) {
                        if (offers.length > 0) return;
                        findOffers(item);
                    }
                } else {
                    // Recurse into object properties
                    for (const key in obj) {
                        if (offers.length > 0) return;
                        findOffers(obj[key]);
                    }
                }
            };
            
            findOffers(data);

            const results: SearchResult[] = [];
            
            for (const offer of offers) {
                // Some items might be ads or have different structures
                if (!offer || typeof offer !== 'object') continue;
                
                const title = offer.name || offer.title;
                if (!title) continue;

                const price = offer.price || 0;
                const id = offer.id;
                const seoName = offer.seoName;
                
                // Construct link
                let link = '';
                if (seoName) {
                    link = `${this.baseUrl}/inzerat/${seoName}`;
                } else if (id) {
                    link = `${this.baseUrl}/inzerat/${id}`;
                } else {
                    continue;
                }
                
                // Get first image
                let imageUrl = '';
                if (offer.images && Array.isArray(offer.images) && offer.images.length > 0) {
                    const firstImg = offer.images[0];
                    imageUrl = typeof firstImg === 'string' ? firstImg : (firstImg.url || firstImg.src || '');
                    
                    if (imageUrl && !imageUrl.startsWith('http')) {
                        imageUrl = `https:${imageUrl.startsWith('//') ? '' : '//'}${imageUrl}`;
                    }

                    // Seznam (sdn.cz) strictness: "original" images return 401 on hotlinking.
                    // Appending a specific transformation profile (fl) allows them to be served.
                    if (imageUrl && imageUrl.includes('sdn.cz') && !imageUrl.includes('?')) {
                        imageUrl += '?fl=exf|crr,1.33333,2|res,640,480,1|wrm,/watermark/sbazar.png,10,10|webp,75';
                    }
                }

                if (options?.cleanSearch && this.isNoise(title, price, query)) {
                    continue;
                }

                results.push({
                    title,
                    price,
                    source: 'Sbazar.cz',
                    region: 'CZ',
                    link,
                    description: offer.locality?.municipality || offer.description || '',
                    imageUrl
                });
            }

            if (maxPrice) {
                return results.filter(r => r.price <= maxPrice);
            }

            return results;

        } catch (error) {
            console.error('Sbazar search failed:', error);
            return [];
        }
    }
}
