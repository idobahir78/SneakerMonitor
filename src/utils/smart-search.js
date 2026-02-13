/**
 * Smart Search Utility
 * Generates flexible Regex patterns from user input string.
 */

class SmartSearch {
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
