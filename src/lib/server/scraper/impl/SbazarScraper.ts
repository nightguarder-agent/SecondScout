import axios from 'axios';
import * as cheerio from 'cheerio';
import type { SearchResult } from '../../scraper';

export class SbazarScraper {
    private readonly baseUrl = 'https://www.sbazar.cz';

    async search(query: string, maxPrice?: number): Promise<SearchResult[]> {
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
