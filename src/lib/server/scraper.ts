import { BazosScraper } from './scraper/impl/BazosScraper';
import { SbazarScraper } from './scraper/impl/SbazarScraper';
import { CyklobazarScraper } from './scraper/impl/CyklobazarScraper';
import { AukroScraper } from './scraper/impl/AukroScraper';
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

export interface Scraper {
    search(query: string, maxPrice?: number, category?: string): Promise<SearchResult[]>;
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
    keywords = keywords.trim();
    if (region === 'CZ') {
        const scrapers: Scraper[] = [];
        const results: SearchResult[] = [];

        // Determine which scrapers to use
        const useAll = !sources || sources.length === 0;

        // Map source names to scraper instances
        // "Bazos", "Sbazar", "Cyklobazar", "Aukro"

        if (useAll || sources?.some(s => s.toLowerCase().includes('bazos'))) {
            scrapers.push(new BazosScraper());
        }
        if (useAll || sources?.some(s => s.toLowerCase().includes('sbazar'))) {
            scrapers.push(new SbazarScraper());
        }
        if (useAll || sources?.some(s => s.toLowerCase().includes('cyklobazar'))) {
            scrapers.push(new CyklobazarScraper());
        }
        if (useAll || sources?.some(s => s.toLowerCase().includes('aukro'))) {
            scrapers.push(new AukroScraper());
        }

        // Run in parallel
        const promises = scrapers.map(s => s.search(keywords, maxPrice, category).catch(e => {
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
        // Germany - still mock for now
        const scraper = new MockScraper('DE');
        return scraper.search(keywords, maxPrice, category);
    }
}
