<script lang="ts">
    import { onMount } from "svelte";

    let logs: string[] = $state([]);
    let processing = $state(false);

    async function runWatchers() {
        processing = true;
        logs = [];
        try {
            const res = await fetch("/api/watchers/run", { method: "POST" });
            const data = await res.json();
            logs = data.logs || [];
            if (logs.length === 0) {
                logs = ["No notifications triggered."];
            }
        } catch (e) {
            logs = ["Error running watchers."];
        } finally {
            processing = false;
        }
    }
</script>

<div class="min-h-screen bg-gray-50 p-8 font-sans text-gray-900">
    <div class="max-w-4xl mx-auto space-y-8">
        <header
            class="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100"
        >
            <div>
                <h1 class="text-3xl font-bold tracking-tight text-gray-900">
                    Watcher Dashboard
                </h1>
                <p class="text-gray-500">Manage your market snipers</p>
            </div>
            <a
                href="/"
                class="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
            >
                Back to Search
            </a>
        </header>

        <div
            class="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center space-y-4"
        >
            <h2 class="text-xl font-bold">Manual Trigger</h2>
            <p class="text-gray-500 max-w-lg mx-auto">
                In a production environment, this would run periodically via a
                cron job. For this MVP, you can trigger the "Sniper" manually to
                check all saved watchers against the mock market.
            </p>
            <button
                onclick={runWatchers}
                disabled={processing}
                class="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-200 disabled:opacity-50"
            >
                {processing ? "Processing..." : "Run Watchers Now"}
            </button>
        </div>

        {#if logs.length > 0}
            <div
                class="bg-gray-900 text-gray-100 p-6 rounded-2xl shadow-lg font-mono text-sm space-y-2"
            >
                <h3
                    class="text-gray-400 font-bold uppercase tracking-wider mb-4 border-b border-gray-700 pb-2"
                >
                    Execution Logs
                </h3>
                {#each logs as log}
                    <div class="flex gap-3">
                        <span class="text-blue-400">➜</span>
                        <span>{log}</span>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>
