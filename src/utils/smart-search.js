/**
 * Smart Search Utility
 * Generates flexible Regex patterns from user input string.
 */

class SmartSearch {
    /**
     * Simplifies a search query to increase match rate on strict sites.
     * e.g. "Lamelo MB.05" -> "MB.05"
     * e.g. "Puma MB.03" -> "MB.03"
     * @param {string} query 
     * @returns {string}
     */
    static simplifyQuery(query) {
        if (!query) return '';

        // Remove "Puma" (generic brand, usually in title but site search might prefer model only)
        // Remove "Lamelo" ONLY if "MB" is also present (to avoid removing it from "Lamelo Shirt")

        let simplified = query;

        // 1. Remove generic brand names that might clutter search
        simplified = simplified.replace(/puma/gi, '');

        // 2. Handle "Lamelo MB" specific case
        if (simplified.match(/mb/i)) {
            simplified = simplified.replace(/lamelo/gi, '');
        }

        // 3. Clean up double spaces
        return simplified.replace(/\s+/g, ' ').trim();
    }

    /**
     * Converts a comma-separated string of models into an array of Regex patterns.
     * Example: "MB.05, LaMelo" -> [/MB[\.\s]?05/i, /LaMelo/i]
     * @param {string} inputStr 
     * @returns {RegExp[]}
     */
    static generatePatterns(inputStr) {
        if (!inputStr) return [];

        const terms = inputStr.split(',').map(t => t.trim()).filter(t => t.length > 0);

        return terms.map(term => {
            // Escape special regex characters except dots which we want to make flexible
            let escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            // Logic:
            // 1. "MB.05" -> We want to match "MB 05", "MB05", "MB.05"
            //    So we replace literal "\." with "[\.\s]?"
            // 2. "MB 05" -> Same goal.

            // Replace dots or spaces with a flexible group
            let patternStr = escaped.replace(/\\\.| /g, '[\\.\\s]?');

            return new RegExp(patternStr, 'i');
        });
    }
}

module.exports = SmartSearch;
