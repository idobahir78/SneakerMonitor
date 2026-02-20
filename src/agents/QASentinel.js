const http = require('http');
const https = require('https');

class QASentinel {
    /**
     * Agent 6 Logic: Final logic and sanity checks before UI rendering.
     * Prevents displaying broken links, dead images, or pricing glitches.
     */
    async check(normalizedItem) {
        if (!normalizedItem) return false;

        const itemTitle = normalizedItem.title || normalizedItem.raw_title || 'Unknown';
        console.log(`[Agent 6 - QA Sentinel] Sanity checking item: ${itemTitle}`);

        // 1. Price Bounds Check (0 < Price < 5000 ILS)
        const price = normalizedItem.price_ils;
        if (typeof price !== 'number' || price <= 0 || price > 5000) {
            console.error(`[Agent 6 - QA Sentinel] FAILED price sanity check: ${price} ILS for ${itemTitle}`);
            return false;
        }

        // 2. HTTP 200 Checks (Image and Product URL)
        // Note: Using HEAD requests to save bandwidth and time.
        try {
            const imageValid = await this._pingUrl(normalizedItem.image_url);

            if (!imageValid) {
                console.error(`[Agent 6 - QA Sentinel] FAILED Image URL check: ${normalizedItem.image_url}`);
                return false;
            }

            const productUrl = normalizedItem.buy_link || '';
            if (!productUrl || !productUrl.startsWith('http')) {
                console.error(`[Agent 6 - QA Sentinel] FAILED Product URL check (missing/invalid): ${productUrl}`);
                return false;
            }

            try {
                new URL(productUrl);
            } catch (e) {
                console.error(`[Agent 6 - QA Sentinel] FAILED Product URL check (malformed): ${productUrl}`);
                return false;
            }

            console.log(`[Agent 6 - QA Sentinel] PASSED all checks: ${itemTitle}`);
            return true;

        } catch (error) {
            console.error(`[Agent 6 - QA Sentinel] Error during checks: ${error.message}`);
            return false;
        }
    }

    /**
     * Performs a lightweight HEAD request to verify an absolute URL is reachable.
     */
    _pingUrl(urlStr) {
        return new Promise((resolve) => {
            if (!urlStr || !urlStr.startsWith('http')) {
                return resolve(false);
            }

            const module = urlStr.startsWith('https') ? https : http;
            const req = module.request(urlStr, { method: 'HEAD', timeout: 3000 }, (res) => {
                // Consider 2xx and 3xx (redirects) as valid existence
                resolve(res.statusCode >= 200 && res.statusCode < 400);
            });

            req.on('error', () => resolve(false));
            req.on('timeout', () => {
                req.destroy();
                resolve(false);
            });
            req.end();
        });
    }
}

module.exports = new QASentinel();
