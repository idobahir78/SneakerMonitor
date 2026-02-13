/**
 * Size Utilities
 * Handles conversion between EU and US sizes for sneakers (Puma specific approx).
 */

class SizeUtils {
    constructor() {
        // Bi-directional mapping could be done, but simple lookup is easier for now.
        // Base approximate mapping for Men's Puma
        this.sizeMap = [
            { eu: 35.5, us: 4 },
            { eu: 36, us: 4.5 },
            { eu: 37, us: 5 },
            { eu: 37.5, us: 5.5 },
            { eu: 38, us: 6 },
            { eu: 38.5, us: 6.5 },
            { eu: 39, us: 7 },
            { eu: 40, us: 7.5 },
            { eu: 40.5, us: 8 },
            { eu: 41, us: 8.5 },
            { eu: 42, us: 9 },
            { eu: 42.5, us: 9.5 },
            { eu: 43, us: 10 },
            { eu: 44, us: 10.5 },
            { eu: 44.5, us: 11 },
            { eu: 45, us: 11.5 },
            { eu: 46, us: 12 },
            { eu: 47, us: 13 },
            { eu: 48, us: 14 }
        ];
    }

    /**
     * Returns an array of relevant sizes (both EU and US) for a given input.
     * If input is "*", returns null (meaning "all sizes").
     * @param {string|number} input 
     * @returns {number[] | null}
     */
    getRelatedSizes(input) {
        if (!input || input === '*' || input === 'all') {
            return null; // No filter
        }

        const numericInput = parseFloat(input);
        if (isNaN(numericInput)) return null;

        // Find matches in map
        const match = this.sizeMap.find(s => s.eu === numericInput || s.us === numericInput);

        if (match) {
            // Return both EU and US to be safe
            return [match.eu, match.us];
        }

        // If not found in map, just return the number itself (maybe it's a specific unique size)
        return [numericInput];
    }
}

module.exports = new SizeUtils();
