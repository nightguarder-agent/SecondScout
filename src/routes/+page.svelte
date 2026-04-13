<script lang="ts">
    interface SearchResult {
        title: string;
        price: number;
        source: string;
        region: "DE" | "CZ";
        description: string;
        imageUrl?: string;
        link: string;
    }

    let region = $state("DE");
    let query = $state("");
    let maxPrice = $state("");
    let results: SearchResult[] = $state([]);
    let loading = $state(false);
    let searching = $state(false);
    let excludedWarning = $state<string | null>(null);

    const ELECTRONICS_KEYWORDS = [
        "iphone",
        "ipad",
        "macbook",
        "samsung",
        "xiaomi",
        "huawei",
        "sony",
        "nintendo",
        "playstation",
        "xbox",
        "televize",
        "tv",
        "laptop",
        "notebook",
        "tablet",
        "mobil",
        "telefon",
        "camera",
        "foťák",
        "canon",
        "nikon",
    ];

    async function search() {
        if (!query) return;
        loading = true;
        searching = true;
        results = [];
        excludedWarning = null;

        try {
            const params = new URLSearchParams({ region, q: query });
            if (maxPrice) params.append("maxPrice", maxPrice);

            // Smart Market Router: Exclude Cyklobazar for electronics
            const qLower = query.toLowerCase();
            if (ELECTRONICS_KEYWORDS.some((k) => qLower.includes(k))) {
                // If electronics, explicitly list unwanted exclusions or just include allowed.
                // Simpler: Send list of allowed sources.
                // Allowed: Bazos, Sbazar, Aukro
                params.append("sources", "Bazos,Sbazar,Aukro");
                excludedWarning = "Cyklobazar excluded for electronics query.";
            }

            const res = await fetch(`/api/search?${params}`);
            if (res.ok) {
                results = await res.json();
            }
        } catch (error) {
            console.error(error);
        } finally {
            loading = false;
        }
    }

    async function addWatcher() {
        if (!query || !maxPrice) return;
        try {
            await fetch("/api/watchers/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    keywords: query,
                    region,
                    max_price: parseFloat(maxPrice),
                }),
            });
            alert("Watcher added!");
        } catch (e) {
            alert("Failed to add watcher");
        }
    }

    function openPreview(item: SearchResult) {
        // Since modern browsers/sites block iframes (X-Frame-Options: DENY), 
        // we use a centered popup window for the "stay-on-app" feeling.
        const width = 1100;
        const height = 900;
        const left = (window.screen.width / 2) - (width / 2);
        const top = (window.screen.height / 2) - (height / 2);
        
        window.open(
            item.link, 
            'DealHunterPreview', 
            `width=${width},height=${height},top=${top},left=${left},menubar=no,toolbar=no,location=no,status=no`
        );
    }

    function proxyImage(url: string | undefined): string {
        if (!url) return '';
        if (!url.startsWith('http')) return url;
        // Use local server-side proxy to bypass hotlink protection (401 errors)
        return `/api/img?url=${encodeURIComponent(url)}`;
    }
</script>

<div class="min-h-screen bg-gray-50 p-8 font-sans text-gray-900">
    <div class="max-w-6xl mx-auto space-y-8">
        <!-- Header -->
        <header
            class="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100"
        >
            <div>
                <h1 class="text-3xl font-bold tracking-tight text-gray-900">
                    DealHunter
                </h1>
                <p class="text-gray-500">Cross-border market aggregator</p>
            </div>
            <a
                href="/watchers"
                class="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
            >
                View Watchers
            </a>
        </header>

        <!-- Search Config -->
        <div
            class="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6"
        >
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                <!-- Market Selector -->
                <div class="relative">
                    <label
                        class="block text-xs font-semibold uppercase text-gray-500 mb-1"
                        for="region">Market</label
                    >
                    <select
                        id="region"
                        bind:value={region}
                        class="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                    >
                        <option value="DE">🇩🇪 Germany (DE)</option>
                        <option value="CZ">🇨🇿 Czech Rep. (CZ)</option>
                    </select>
                </div>

                <!-- Keywords -->
                <div class="md:col-span-2">
                    <label
                        class="block text-xs font-semibold uppercase text-gray-500 mb-1"
                        for="query">Keywords</label
                    >
                    <input
                        id="query"
                        type="text"
                        bind:value={query}
                        placeholder="e.g. Shimano DI2"
                        class="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>

                <!-- Price -->
                <div>
                    <label
                        class="block text-xs font-semibold uppercase text-gray-500 mb-1"
                        for="price"
                        >Max Price ({region === "CZ" ? "Kč" : "€"})</label
                    >
                    <input
                        id="price"
                        type="number"
                        bind:value={maxPrice}
                        placeholder="500"
                        class="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
            </div>

            <!-- Actions -->
            <div class="flex gap-3">
                <button
                    onclick={search}
                    disabled={loading}
                    class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? "Searching..." : "Search Market"}
                </button>
                <button
                    onclick={addWatcher}
                    class="px-6 py-3 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 transition-all shadow-lg shadow-gray-200"
                >
                    Add Watcher
                </button>
            </div>
        </div>

        <!-- Results -->
        {#if searching}
            <div>
                <h2 class="text-xl font-bold mb-4 flex items-center gap-2">
                    Running Search
                    {#if loading}<span class="animate-pulse">...</span>{/if}
                </h2>

                {#if excludedWarning}
                    <div
                        class="mb-4 text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200"
                    >
                        {excludedWarning}
                    </div>
                {/if}

                <div
                    class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                    {#each results as item}
                        <div
                            class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group flex flex-col"
                        >
                            <div
                                class="h-48 bg-gray-100 relative overflow-hidden"
                            >
                                {#if item.imageUrl}
                                    <img
                                        src={proxyImage(item.imageUrl)}
                                        alt={item.title}
                                        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                {/if}
                                <div
                                    class="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-bold shadow-sm"
                                >
                                    {item.source}
                                </div>
                            </div>
                            <div class="p-5 flex-1 flex flex-col">
                                <div
                                    class="flex justify-between items-start mb-2"
                                >
                                    <h3
                                        class="font-bold text-lg leading-tight text-gray-900"
                                    >
                                        {item.title}
                                    </h3>
                                    <span
                                        class="text-green-600 font-bold bg-green-50 px-2 py-1 rounded-lg"
                                        >{item.region === "CZ"
                                            ? "Kč"
                                            : "€"}{item.price}</span
                                    >
                                </div>
                                <p
                                    class="text-gray-500 text-sm mb-4 line-clamp-2"
                                >
                                    {item.description}
                                </p>
                                <div class="mt-auto flex gap-2">
                                    <button
                                        onclick={() => openPreview(item)}
                                        class="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium rounded-lg transition-colors text-sm"
                                    >
                                        Preview
                                    </button>
                                    <a
                                        href={item.link}
                                        target="_blank"
                                        class="flex-1 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 font-medium rounded-lg transition-colors text-sm text-center flex items-center justify-center"
                                    >
                                        View Original
                                    </a>
                                </div>
                            </div>
                        </div>
                    {/each}

                    {#if !loading && results.length === 0}
                        <div
                            class="col-span-full py-12 text-center text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200"
                        >
                            No results found. Try adjusting your filters.
                        </div>
                    {/if}
                </div>
            </div>
        {/if}
    </div>
</div>
