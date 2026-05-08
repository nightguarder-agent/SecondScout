import { BazosScraper } from './scraper/impl/BazosScraper';
import { SbazarScraper } from './scraper/impl/SbazarScraper';
import { CyklobazarScraper } from './scraper/impl/CyklobazarScraper';
import { AukroScraper } from './scraper/impl/AukroScraper';
import { KleinanzeigenScraper } from './scraper/impl/KleinanzeigenScraper';
import { AntiScamService } from './scraper/anti_scam/AntiScamService';
import { pb } from '$lib/server/pocketbase';

export interface SearchResult {
    title: string;
    price: number;
    source: string;
    region: 'DE' | 'CZ';
    link: string;
    description: string;
    imageUrl?: string;
    isScam?: boolean;
}

export interface SearchOptions {
    maxPrice?: number;
    category?: string;
    sources?: string[];
    cleanSearch?: boolean;
    negativeKeywords?: string[];
}

export interface Scraper {
    search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
}

export function parseQuery(query: string): { cleanedQuery: string, negativeKeywords: string[] } {
    const tokens = query.split(/\s+/);
    const negativeKeywords: string[] = [];
    const positiveTokens: string[] = [];

    for (const token of tokens) {
        if (token.startsWith('-') && token.length > 1) {
            negativeKeywords.push(token.substring(1).toLowerCase());
        } else {
            positiveTokens.push(token);
        }
    }

    return {
        cleanedQuery: positiveTokens.join(' '),
        negativeKeywords
    };
}

const ELECTRONICS_KEYWORDS = [
    "iphone", "ipad", "macbook", "samsung", "xiaomi", "huawei", "sony", "nintendo", 
    "playstation", "xbox", "televize", "tv", "laptop", "notebook", "tablet", "mobil"
];

const SPORT_KEYWORDS = [
    "shimano", "sram", "garmin", "specialized", "trek", "canyon", "cube", "giant", 
    "scott", "bianchi", "pinarello", "colnago", "merida", "ktm", "focus", "ghost",
    "rockshox", "fox", "campagnolo", "bicycle", "kolo", "bike"
];

export function detectCategory(query: string): string | undefined {
    const lowerQuery = query.toLowerCase();
    
    if (ELECTRONICS_KEYWORDS.some(k => lowerQuery.includes(k))) {
        return 'elektro'; // Common category name across Bazos/Sbazar
    }
    
    if (SPORT_KEYWORDS.some(k => lowerQuery.includes(k))) {
        return 'sport';
    }
    
    return undefined;
}

const MOCK_IMAGES = [
    'https://placehold.co/300x200?text=Item+1',
    'https://placehold.co/300x200?text=Item+2',
    'https://placehold.co/300x200?text=Item+3',
];

class MockScraper implements Scraper {
    private region: 'DE' | 'CZ';

    constructor(region: 'DE' | 'CZ') {
        this.region = region;
    }

    async search(keywords: string, maxPrice?: number, category?: string): Promise<SearchResult[]> {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 800));

        const results: SearchResult[] = [];
        const count = Math.floor(Math.random() * 5) + 3; // 3 to 7 items

        for (let i = 0; i < count; i++) {
            const isDe = this.region === 'DE';
            const source = isDe
                ? (Math.random() > 0.5 ? 'Kleinanzeigen' : 'eBay.de')
                : (Math.random() > 0.5 ? 'Bazos.cz' : 'Cyklobazar');

            const price = Math.floor(Math.random() * (maxPrice ? maxPrice * 1.2 : 500)) + 10;

            if (maxPrice && price > maxPrice) continue;

            results.push({
                title: `${keywords} ${i + 1} - ${isDe ? 'Gebraucht' : 'Použité'}`,
                price,
                source,
                region: this.region,
                link: '#',
                description: isDe
                    ? 'Sehr guter Zustand, wenig benutzt.'
                    : 'Velmi dobrý stav, málo používané.',
                imageUrl: MOCK_IMAGES[i % MOCK_IMAGES.length]
            });
        }
        return results;
    }
}

export async function searchMarket(
    region: 'DE' | 'CZ',
    keywords: string,
    maxPrice?: number,
    category?: string,
    sources?: string[] // Optional specific sources
): Promise<SearchResult[]> {
    const { cleanedQuery, negativeKeywords } = parseQuery(keywords);
    const detectedCategory = category || detectCategory(cleanedQuery);

    if (region === 'CZ') {
        const scrapers: Scraper[] = [];
        const results: SearchResult[] = [];

        // Determine which scrapers to use
        const useAll = !sources || sources.length === 0;

        if (useAll || sources?.some(s => s.toLowerCase().includes('bazos'))) {
            scrapers.push(new BazosScraper());
        }
        // Skip Sbazar for electronics to avoid common accessory noise
        if (detectedCategory !== 'elektro' && (useAll || sources?.some(s => s.toLowerCase().includes('sbazar')))) {
            scrapers.push(new SbazarScraper());
        }
        if (useAll || sources?.some(s => s.toLowerCase().includes('cyklobazar'))) {
            scrapers.push(new CyklobazarScraper());
        }
        if (useAll || sources?.some(s => s.toLowerCase().includes('aukro'))) {
            scrapers.push(new AukroScraper());
        }

        // Run in parallel
        const options: SearchOptions = { 
            maxPrice, 
            category: detectedCategory, 
            sources, 
            cleanSearch: true,
            negativeKeywords
        };
        
        const promises = scrapers.map(s => s.search(cleanedQuery, options).catch(e => {
            console.error(`Scraper failed:`, e);
            return [];
        }));

        const scraperResults = await Promise.all(promises);
        scraperResults.forEach(r => results.push(...r));

        // Deduplicate results by link
        const uniqueResults = Array.from(
            new Map(results.map(item => [item.link, item])).values()
        );

        // Check for scams
        try {
            const antiScam = new AntiScamService(pb);
            const urls = uniqueResults.map(r => r.link);
            const scamUrls = await antiScam.getScamUrls(urls);

            if (scamUrls.size > 0) {
                uniqueResults.forEach(item => {
                    if (scamUrls.has(item.link)) {
                        item.isScam = true;
                    }
                });
            }
        } catch (e) {
            console.error('Anti-Scam check failed:', e);
            // Don't fail the whole search if anti-scam fails
        }

        return uniqueResults.sort((a, b) => a.price - b.price);

    } else {
        // Germany - use Kleinanzeigen scraper
        const scrapers: Scraper[] = [];
        const useAll = !sources || sources.length === 0;

        if (useAll || sources?.some(s => s.toLowerCase().includes('kleinanzeigen'))) {
            scrapers.push(new KleinanzeigenScraper());
        }

        if (scrapers.length === 0) {
            // Fallback to mock if no scrapers matched
            const scraper = new MockScraper('DE');
            return scraper.search(keywords, maxPrice, category);
        }

        const options: SearchOptions = { 
            maxPrice, 
            category: detectedCategory, 
            sources, 
            cleanSearch: true,
            negativeKeywords
        };

        const results: SearchResult[] = [];
        const promises = scrapers.map(s => s.search(cleanedQuery, options).catch(e => {
            console.error(`Scraper failed:`, e);
            return [];
        }));

        const scraperResults = await Promise.all(promises);
        scraperResults.forEach(r => results.push(...r));

        return results.sort((a, b) => a.price - b.price);
    }
}
