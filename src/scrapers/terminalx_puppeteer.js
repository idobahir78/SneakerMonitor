const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const vm = require('vm');

class TerminalXPuppeteerScraper {
    constructor(query) {
        this.query = query;
        this.storeName = 'Terminal X';
        this.baseUrl = 'https://www.terminalx.com/men/neliim/sniqrs';
    }

    async scrape(browser) {
        console.log(`[TerminalX] Launching for query: ${this.query}`);
        let page;

        try {
            page = await browser.newPage();
            await page.setViewport({ width: 1366, height: 768 });

            console.log(`[TerminalX] Navigating to ${this.baseUrl}...`);
            await page.goto(this.baseUrl, { waitUntil: 'networkidle2', timeout: 60000 });

            // Extract State (DOM)
            let extractedState = await page.evaluate(() => {
                if (window.__INITIAL_STATE__) return window.__INITIAL_STATE__;
                return null;
            });

            // Fallback: Parse HTML
            if (!extractedState) {
                console.log("[TerminalX] __INITIAL_STATE__ missing in window. Attempting HTML parse...");
                try {
                    const html = await page.content();
                    const startMarker = 'window.__INITIAL_STATE__ =';
                    const startIndex = html.indexOf(startMarker);

                    if (startIndex !== -1) {
                        const scriptEnd = html.indexOf('</script>', startIndex);
                        if (scriptEnd !== -1) {
                            const scriptContent = html.substring(startIndex, scriptEnd);
                            const sandbox = { window: {} };
                            vm.runInNewContext(scriptContent, sandbox);
                            if (sandbox.window && sandbox.window.__INITIAL_STATE__) {
                                extractedState = sandbox.window.__INITIAL_STATE__;
                            }
                        }
                    } else {
                        const match = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{.*?\});/);
                        if (match && match[1]) extractedState = JSON.parse(match[1]);
                    }
                } catch (err) {
                    console.error("[TerminalX] Fallback extraction failed:", err.message);
                }
            }

            if (!extractedState) {
                console.error("[TerminalX] __INITIAL_STATE__ NOT FOUND.");
                return [];
            }

            // Drill down to products
            let productsRaw = [];
            try {
                const listing = extractedState.listingAndSearchStoreData.data.listing;
                if (listing.products) productsRaw = listing.products;
                else if (listing.items) productsRaw = listing.items;
            } catch (e) { }

            // Handle non-array
            if (productsRaw && !Array.isArray(productsRaw)) {
                if (productsRaw.items && Array.isArray(productsRaw.items)) productsRaw = productsRaw.items;
                else if (productsRaw.hits && Array.isArray(productsRaw.hits)) productsRaw = productsRaw.hits;
                else if (Object.values(productsRaw).length > 0) productsRaw = Object.values(productsRaw);
            }

            if (!productsRaw || !Array.isArray(productsRaw) || productsRaw.length === 0) {
                console.log("[TerminalX] No products found in State.");
                return [];
            }

            // Map products
            const mappedProducts = productsRaw.map(p => {
                try {
                    let price = 0;
                    if (p.price_range?.maximum_price?.final_price) price = p.price_range.maximum_price.final_price.value;
                    else if (p.price_range?.minimum_price?.final_price) price = p.price_range.minimum_price.final_price.value;

                    let title = p.name || p.sku;
                    let image = '';
                    if (p.image?.url) image = p.image.url;
                    else if (p.thumbnail?.url) image = p.thumbnail.url;
                    else if (p.small_image?.url) image = p.small_image.url;
                    else if (p.media_gallery?.length > 0) image = p.media_gallery[0].url;

                    let link = p.url_key ? `https://www.terminalx.com/${p.url_key}` : `https://www.terminalx.com/catalog/product/view/id/${p.id}`;

                    return {
                        title: title,
                        price: price,
                        store: 'Terminal X',
                        link: link,
                        image: image,
                        brand: p.brand
                    };
                } catch (err) { return null; }
            }).filter(p => p !== null);

            // 6. Filter by Query (Client Side - Improved Token Based)
            const queryLower = this.query.toLowerCase();
            const queryTokens = queryLower.split(' ').filter(t => t.trim().length > 0);

            const filtered = mappedProducts.filter(p => {
                const text = (p.title + ' ' + (p.brand || '') + ' ' + (p.sku || '')).toLowerCase();
                // Check if ALL tokens exist in the text (e.g. "Puma" AND "MB.05")
                return queryTokens.every(token => text.includes(token));
            });

            console.log(`[TerminalX] Valid products: ${mappedProducts.length}, Matching '${this.query}': ${filtered.length}`);

            if (filtered.length === 0 && mappedProducts.length > 0) {
                console.log("[TerminalX] Strict Filter returned 0. Applying Fallback (Brand Match)...");

                // Fallback: Only return items where the Brand (if present) matches one of the query tokens
                const fallbackFiltered = mappedProducts.filter(p => {
                    if (!p.brand) return true; // Keep generic items
                    const brand = p.brand.toLowerCase();
                    return queryLower.includes(brand) || brand.includes(queryLower);
                });

                console.log(`[TerminalX] Fallback kept ${fallbackFiltered.length} items.`);
                return fallbackFiltered;
            }

            return filtered;

        } catch (e) {
            console.error("[TerminalX] Scrape failed:", e.message);
            return [];
        } finally {
            if (page) await page.close();
        }
    }
}

module.exports = TerminalXPuppeteerScraper;
