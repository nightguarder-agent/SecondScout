/**
 * Utility functions shared across scraper implementations.
 * Provides tokenization and token matching logic used for advanced keyword selection.
 */

/**
 * Splits a string into normalized tokens.
 * - Lower‑cases the input.
 * - Replaces hyphens/underscores with spaces.
 * - Removes empty tokens.
 * - Normalises model tokens like "m2" and numeric tokens.
 */
export function tokenize(text: string): string[] {
    const lower = text.toLowerCase().trim();
    return lower
        .replace(/[-_]/g, ' ')
        .split(/\s+/)
        .filter(token => token.length > 0)
        .map(token => {
            if (/^m\d+$/i.test(token)) return token.toLowerCase(); // m2, m3
            if (/^\d{2,4}$/.test(token)) return token; // simple numbers like 15, 2020
            // Strip non‑numeric characters but keep numbers (e.g., "15GB" → "15")
            const numeric = token.replace(/[^0-9]/g, '');
            if (numeric.length > 0) return numeric;
            return token;
        });
}

/**
 * Returns true if **all** query tokens are present (as substrings) in the title tokens.
 * Allows fuzzy matching where a token can be a substring of another token.
 */
export function hasAllTokens(titleTokens: string[], queryTokens: string[]): boolean {
    return queryTokens.every(qToken =>
        titleTokens.some(tToken => tToken.includes(qToken) || qToken.includes(tToken))
    );
}
