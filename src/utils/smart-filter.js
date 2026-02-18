const SmartFilter = {
    /**
     * Filters a list of products based on a search query using "Smart Fallback" logic.
     * @param {Array} products - Array of product objects {title, brand, price, ...}
     * @param {String} query - The search query (e.g. "New Balance 530")
     * @returns {Array} - The filtered list of products.
     */
    filter: (products, query) => {
        if (!products || products.length === 0) return [];
        if (!query) return products;

        const queryLower = query.toLowerCase();
        const queryTokens = queryLower.split(' ').filter(t => t.trim().length > 0);

        // 1. Strict Token Match (All tokens must exist)
        const strictFiltered = products.filter(p => {
            const text = (p.title + ' ' + (p.brand || '') + ' ' + (p.sku || '')).toLowerCase();
            return queryTokens.every(token => text.includes(token));
        });

        // If strict match works, return it.
        // UNLESS it filtered out everything but we had candidates.
        if (strictFiltered.length > 0) {
            console.log(`[SmartFilter] Strict match found ${strictFiltered.length} items.`);
            return strictFiltered;
        }

        if (products.length > 0) {
            console.log("[SmartFilter] Strict Filter returned 0. Applying Smart Fallback (Brand + Number)...");

            // 2. Smart Fallback: "Brand + Model Number"
            const fallbackFiltered = products.filter(p => {
                const text = (p.title + ' ' + (p.brand || '') + ' ' + (p.sku || '')).toLowerCase();

                // If query has a number (e.g. "530"), that number MUST be present.
                const numberMatch = queryLower.match(/\d+/);
                if (numberMatch) {
                    const number = numberMatch[0];
                    const isNumberInText = text.includes(number);

                    // Relaxed Brand Check:
                    // Does the product brand (if exists) appear in the query? 
                    // OR does "New Balance" appear in the product text?
                    const isBrandInText = p.brand ?
                        (queryLower.includes(p.brand.toLowerCase()) || p.brand.toLowerCase().includes('new balance')) : false; // optimize for NB

                    // Special case: If brand is missing from product data, but "New Balance" is in the title, count it.
                    const isBrandInTitle = text.includes('new balance') || text.includes('newbalance') || text.includes('nike') || text.includes('adidas');

                    return isNumberInText && (isBrandInText || isBrandInTitle);
                }

                // Generic Fallback (No number in query): Match at least 50% of tokens
                const tokens = queryLower.split(' ').filter(t => t.length > 1);
                const matches = tokens.filter(t => text.includes(t));
                return matches.length >= Math.ceil(tokens.length / 2);
            });

            console.log(`[SmartFilter] Smart Fallback kept ${fallbackFiltered.length} items.`);
            return fallbackFiltered;
        }

        return [];
    }
};

module.exports = SmartFilter;
