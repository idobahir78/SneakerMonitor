class UXPolisher {
    /**
     * Agent 7 Logic: Prepares the final JSON object for the UI card.
     */
    format(saneItem) {
        if (!saneItem) return null;

        const rawTitle = saneItem.title || saneItem.raw_title || 'Unknown';
        console.log(`[Agent 7 - UX Polisher] Formatting item for UI: ${rawTitle}`);

        try {
            // 1. Title Truncation (Max 40 chars)
            let displayTitle = rawTitle;

            const words = displayTitle.split(/\s+/);
            const seen = new Set();
            const deduped = [];
            for (const word of words) {
                const upper = word.toUpperCase();
                if (seen.has(upper) && upper.length > 2) continue;
                seen.add(upper);
                deduped.push(word);
            }
            displayTitle = deduped.join(' ');

            if (displayTitle.length > 40) {
                const shortened = displayTitle.substring(0, 40);
                displayTitle = shortened.substr(0, Math.min(shortened.length, shortened.lastIndexOf(" "))) + '...';
            }

            // 2. Formatting Badges (Best Price logic happens at the Orchestrator/API level 
            // once a cohort is collected, but we prepare the array here).
            const badges = [];
            // Optional: tag specific known stores or conditions immediately
            if (saneItem.store_name.toLowerCase().includes('terminal')) {
                // Example badge 
                // badges.push("Fast Shipping");
            }

            // 3. Final JSON Assembly matching User Prompt schema
            return {
                id: saneItem.id,
                display_title: displayTitle,
                price_ils: saneItem.price_ils,
                size_available: saneItem.size_available,
                sizes: saneItem.sizes || [],
                image_url: saneItem.image_url,
                badges: badges,
                buy_link: saneItem.buy_link,
                store_name: saneItem.store_name
            };

        } catch (error) {
            console.error(`[Agent 7 - UX Polisher] Formatting error:`, error.message);
            return null;
        }
    }

    /**
     * Cross-Cohort Analysis (Requires full dataset, usually called after parallel streams finish)
     * e.g. Assigning "Best Price" badge based on the lowest 20%
     */
    applyCohortBadges(finalItems) {
        if (!finalItems || finalItems.length === 0) return finalItems;

        // Sort by price
        const sorted = [...finalItems].sort((a, b) => a.price_ils - b.price_ils);

        // Calculate the threshold for the bottom 20%
        const limitIndex = Math.max(1, Math.floor(finalItems.length * 0.2));
        const thresholdPrice = sorted[limitIndex - 1].price_ils;

        return finalItems.map(item => {
            if (item.price_ils <= thresholdPrice) {
                item.badges.push("Best Price");
            }
            return item;
        });
    }
}

module.exports = new UXPolisher();
