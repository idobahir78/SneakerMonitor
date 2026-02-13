const BaseScraper = require('./base-scraper');

class StockXScraper extends BaseScraper {
    constructor(searchTerm) {
        // Use provided search term or default
        const query = searchTerm || 'puma lamelo';
        const url = `https://stockx.com/search?s=${encodeURIComponent(query)}`;
        super('StockX', url);
        this.searchTerm = query;
    }

    async parse(page) {
        // Forward browser console logs to Node terminal
        // page.on('console', msg => console.log('PAGE LOG:', msg.text()));

        const title = await page.title();
        console.log(`[DEBUG] StockX Page Title: "${title}"`);

        // Wait for general product tiles
        try {
            await page.waitForSelector('[data-testid="product-tile"], div[class*="product-tile"], a[href*="/"]', { timeout: 25000 });
        } catch (e) {
            console.log("StockX: Timeout waiting for tiles (might still find something).");
        }

        if (title.includes("Just a moment") || title.includes("Access Denied") || title.includes("Challenge")) {
            console.error("❌ StockX Blocked: Cloudflare/Captcha detected. Manual intervention required to solve CAPTCHA.");
            // Do NOT return empty immediately. Let the user see the browser and maybe solve it.
        }

        return await page.evaluate(() => {
            const results = [];

            // Strategy 1: Test ID (Best)
            let tiles = Array.from(document.querySelectorAll('[data-testid="product-tile"]'));

            // Strategy 2: Generic Class (Fallback)
            if (tiles.length === 0) {
                tiles = Array.from(document.querySelectorAll('div[class*="product-tile"]'));
            }

            // Strategy 3: Just find links that look like products (Last resort)
            if (tiles.length === 0) {
                // Common on StockX: links to product pages (excluding search/help/login)
                // This effectively grabs almost any link in the grid
                tiles = Array.from(document.querySelectorAll('a')).filter(a =>
                    a.href.match(/\/[a-z0-9-]+$/) &&
                    !a.href.includes('/search') &&
                    !a.href.includes('/help') &&
                    !a.href.includes('/login') &&
                    !a.href.includes('/about')
                );
            }

            console.log(`[DEBUG] StockX found ${tiles.length} potential tiles.`);

            // NEW: Inspect __NEXT_DATA__ for hidden product info
            try {
                const nextData = JSON.parse(document.getElementById('__NEXT_DATA__').innerHTML);
                console.log('[DEBUG] __NEXT_DATA__ Found!');

                // Helper to safely log keys
                const logKeys = (obj, label) => {
                    if (obj && typeof obj === 'object') {
                        console.log(`[DEBUG] ${label} Keys: ${Object.keys(obj).join(', ')}`);
                    }
                };

                const props = nextData.props?.pageProps;
                logKeys(props, 'pageProps');

                // Check React Query (Dehydrated State)
                const queries = props?.dehydratedState?.queries;
                if (queries && Array.isArray(queries)) {
                    console.log(`[DEBUG] Found ${queries.length} React Queries.`);
                    queries.forEach((q, i) => {
                        const data = q.state?.data;
                        if (data?.browse?.results) {
                            console.log(`[DEBUG] Query[${i}] has 'browse.results'! Length: ${data.browse.results.length}`);
                            const first = data.browse.results[0];
                            console.log(`[DEBUG] First Product Keys: ${Object.keys(first).join(', ')}`);
                            if (first.variants) console.log(`[DEBUG] First Product Variants: ${JSON.stringify(first.variants).substring(0, 200)}...`);
                        }
                    });
                }
            } catch (e) {
                console.log(`[DEBUG] Error parsing __NEXT_DATA__: ${e.message}`);
            }

            tiles.forEach(tile => {
                // Determine structure: Is 'tile' the link itself or a wrapper?
                let linkEl = tile.tagName === 'A' ? tile : tile.querySelector('a');

                // If still no link, skip
                if (!linkEl) return;

                const text = tile.innerText;
                const lines = text.split('\n').filter(l => l.trim().length > 0);

                let title = '';
                let priceUSD = 0;

                if (lines.length > 0) {
                    title = lines[0]; // First line is usually title

                    // Attempt to find price line (e.g. "$125", "Check Price")
                    const priceLine = lines.find(l => l.includes('$') || l.match(/[0-9]+/));
                    if (priceLine) {
                        const priceMatch = priceLine.match(/[0-9.]+/);
                        if (priceMatch) {
                            priceUSD = parseFloat(priceMatch[0]);
                        }
                    }
                }

                if (title) {
                    // Convert USD to ILS (Approx 3.8)
                    const price = priceUSD ? priceUSD * 3.8 : 0;

                    // StockX grid does NOT show sizes. 
                    // We return empty array so monitor.js knows to include it as "Unknown Size" match.
                    const sizes = [];

                    results.push({
                        store: 'StockX',
                        title,
                        price,
                        link: linkEl.href,
                        sizes
                    });
                }
            });
            return results;
        });
    }
    async parseSizes(page) {
        // StockX PDP: Extract sizes from __NEXT_DATA__
        return await page.evaluate(() => {
            try {
                const nextData = JSON.parse(document.getElementById('__NEXT_DATA__').innerHTML);
                const props = nextData.props?.pageProps;

                // Try to find product object
                const product = props?.req?.appContext?.product || props?.product;

                if (product && product.variants) {
                    return product.variants.map(v => {
                        // StockX size structure: v.traits.size (string)
                        // v.hidden (bool) - verify if we should ignore hidden?
                        // Usually available sizes are listed.
                        // We might need to check if 'market.lowestAsk' exists to confirm it's buyable?
                        // For now, listing all listed sizes.
                        const sizeTrait = v.traits?.find(t => t.name === 'Size');
                        return sizeTrait ? sizeTrait.value : null;
                    }).filter(s => s !== null);
                }

                // Fallback: React Query cache?
                const queries = props?.dehydratedState?.queries;
                if (queries) {
                    // Try to find a query with product data
                    // This is harder to pinpoint without exact key.
                }

                return [];
            } catch (e) {
                console.log("StockX parseSizes error:", e);
                return [];
            }
        });
    }
}

module.exports = StockXScraper;
