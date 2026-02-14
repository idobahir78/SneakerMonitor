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

            tiles.forEach(tile => {
                // Determine structure: Is 'tile' the link itself or a wrapper?
                let linkEl = tile.tagName === 'A' ? tile : tile.querySelector('a');

                // If still no link, skip
                if (!linkEl) return;

                const text = tile.innerText;
                const lines = text.split('\n').filter(l => l.trim().length > 0);

                let title = '';
                let price = 0;

                if (lines.length > 0) {
                    title = lines[0]; // First line is usually title

                    // 1. Try to find price in Shekels (No conversion)
                    const shekelLine = lines.slice(1).find(l => l.includes('₪'));

                    if (shekelLine) {
                        const match = shekelLine.replace(/,/g, '').match(/[0-9.]+/);
                        if (match) price = parseFloat(match[0]);
                    }

                    // 2. If not found, look for USD ($)
                    if (price === 0) {
                        const dollarLine = lines.slice(1).find(l => l.includes('$'));
                        if (dollarLine) {
                            const match = dollarLine.replace(/,/g, '').match(/[0-9.]+/);
                            if (match) price = parseFloat(match[0]) * 3.8;
                        }
                    }
                }

                if (title && price > 0) {
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
                        const sizeTrait = v.traits?.find(t => t.name === 'Size');
                        return sizeTrait ? sizeTrait.value : null;
                    }).filter(s => s !== null);
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
