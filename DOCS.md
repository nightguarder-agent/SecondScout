# SecondScout Documentation

SecondScout is a high-performance second-hand market aggregator designed to help power users find deals across multiple platforms in the Czech Republic and Germany.

## Architecture

The project is built with:
- **Frontend**: Svelte 5 (using Runes) and Tailwind CSS.
- **Backend**: SvelteKit server-side routes (API) and PocketBase for data persistence.
- **Scrapers**: Custom TypeScript scrapers using Axios and Cheerio.
- **Anti-Scam**: Integration with "Podvody na Bazaru" to identify known scammers.

## Project Structure

```text
src/
├── lib/
│   ├── server/
│   │   ├── scraper/          # Scraper logic
│   │   │   ├── impl/         # Individual provider scrapers (Bazos, Sbazar, etc.)
│   │   │   └── anti_scam/    # Anti-scam service and scrapers
│   │   ├── pocketbase.ts     # PocketBase client configuration
│   │   ├── scraper.ts        # Main search orchestration logic
│   │   └── watcher.ts        # Watcher execution logic
├── routes/
│   ├── api/                  # API endpoints for search, watchers, and cron
│   └── watchers/             # Watcher management UI
```

## Scrapers

Each scraper implements the `Scraper` interface defined in `src/lib/server/scraper.ts`:

```typescript
export interface Scraper {
    search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
}
```

### Supported Providers
- **Bazos.cz**: Direct scraping with rate-limit handling and noise filtering.
- **Sbazar.cz**: Scrapes Astro-serialized data from the page.
- **Cyklobazar.cz**: Specialized for cycling equipment.
- **Aukro.cz**: Czech auction site.

### Noise Filtering
Most scrapers implement `isNoise` and `verifyStrictMatch` methods to filter out:
- Accessories (covers, cases, etc.) when searching for the main device.
- Model mismatches (e.g., "Pro Max" when searching for "Pro").
- Wanted/Exchange ads ("koupím", "vyměním").

## Anti-Scam Service

The `AntiScamService` (`src/lib/server/scraper/anti_scam/AntiScamService.ts`) syncs data from `podvodynabazaru.cz` into PocketBase. 
During search, results are checked against this database. If a link matches a known scam report, it is flagged with `isScam: true`.

## Watchers

Watchers are automated searches that run periodically via a cron job.
- **Creation**: Users add keywords, max price, and region.
- **Execution**: The `src/lib/server/watcher.ts` runs searches for all active watchers and could be extended to send notifications (email/discord).

## Adding a New Scraper

1. Create a new class in `src/lib/server/scraper/impl/`.
2. Implement the `Scraper` interface.
3. Register the scraper in `src/lib/server/scraper.ts` within the `searchMarket` function.
4. (Optional) Add provider-specific categories or filters.
