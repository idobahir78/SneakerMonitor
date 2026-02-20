class DataNormalizer {
    /**
     * Agent 5 Logic: Standardizes prices, sizes, and validates URL integrity.
     */
    normalize(rawItem, storeName) {
        if (!rawItem) return null;

        console.log(`[Agent 5 - Normalizer] Processing item from ${storeName}`);

        try {
            // 1. Price Conversion to Number (ILS)
            let priceIls = 0;
            if (typeof rawItem.raw_price === 'string') {
                // Remove currency symbols (₪, NIS, $, etc.) and commas
                const cleanedPrice = rawItem.raw_price.replace(/[^\d.]/g, '');
                priceIls = parseFloat(cleanedPrice);
            } else if (typeof rawItem.raw_price === 'number') {
                priceIls = rawItem.raw_price;
            }

            // 2. Size Standardization (EU format)
            let sizeAvailable = rawItem.raw_size || 'Available';
            if (typeof sizeAvailable === 'string' && sizeAvailable.toLowerCase().includes('us')) {
                // Basic conversion mock. In real app, standardise US to EU.
                sizeAvailable = sizeAvailable.replace(/us/i, '').trim() + ' (US)';
            }

            // 3. Product URL Integrity Check
            let productUrl = rawItem.raw_url || rawItem.product_url || '';
            if (productUrl && !productUrl.startsWith('http')) {
                // Fix relative paths if possible, else it's invalid
                // Placeholder logic: assuming base store logic handled this in DOMNavigator
                if (productUrl.startsWith('/')) {
                    console.warn(`[Agent 5 - Normalizer] Warning: Relative URL found for ${rawItem.raw_title}`);
                }
            }

            return {
                id: rawItem.id || `item_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                // --- New schema fields ---
                title: rawItem.raw_title,       // normalized alias
                display_title: rawItem.raw_title,
                raw_title: rawItem.raw_title,
                price_ils: priceIls,
                size_available: sizeAvailable,
                image_url: rawItem.raw_image_url,
                buy_link: productUrl,
                store_name: storeName,
                // --- Legacy field aliases (for backward-compat with existing frontend) ---
                price: priceIls,               // ShoeCard reads item.price
                link: productUrl,              // ShoeCard reads item.link
                store: storeName,              // ShoeCard reads item.store
                image: rawItem.raw_image_url,  // legacy alias
                sizes: rawItem.raw_sizes || [] // legacy sizes array
            };

        } catch (error) {
            console.error(`[Agent 5 - Normalizer] Error normalizing data from ${storeName}:`, error.message);
            return null; // Discard corrupted data
        }
    }
}

module.exports = new DataNormalizer();
