const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const vm = require('vm');
const SmartFilter = require('../utils/smart-filter');

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
                try {
                    const html = await page.content();
                    const markers = [
                        'window.__INITIAL_STATE__ =',
                        'window.__INITIAL_STATE__=',
                    ];

                    let startIndex = -1;
                    for (const m of markers) {
                        startIndex = html.indexOf(m);
                        if (startIndex !== -1) break;
                    }

                    if (startIndex !== -1) {
                        const scriptEnd = html.indexOf('</script>', startIndex);
                        if (scriptEnd !== -1) {
                            let scriptContent = html.substring(startIndex, scriptEnd);
                            const sandbox = { window: {} };
                            vm.createContext(sandbox);
                            vm.runInContext(scriptContent, sandbox);

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
            } catch (e) {
                console.log("[TerminalX] Path retrieval error:", e.message);
            }

            if (productsRaw && !Array.isArray(productsRaw)) {
                if (productsRaw.items && Array.isArray(productsRaw.items)) productsRaw = productsRaw.items;
                else if (productsRaw.hits && Array.isArray(productsRaw.hits)) productsRaw = productsRaw.hits;
                else if (Object.values(productsRaw).length > 0) productsRaw = Object.values(productsRaw);
            }

            if (!productsRaw || !Array.isArray(productsRaw) || productsRaw.length === 0) {
                console.log("[TerminalX] No products found in State.");
                return [];
            }

            console.log(`[TerminalX] Found ${productsRaw.length} raw products. Starting Loop.`);

            // Map products
            const mappedProducts = [];
            for (let i = 0; i < productsRaw.length; i++) {
                const p = productsRaw[i];
                if (!p) continue;

                try {
                    let price = 0;
                    if (p.price_range?.maximum_price?.final_price) price = p.price_range.maximum_price.final_price.value;
                    else if (p.price_range?.minimum_price?.final_price) price = p.price_range.minimum_price.final_price.value;
                    else if (p.price) price = p.price;

                    let title = p.meta_title || p.name || p.sku;
                    if (!title || title === p.sku) {
                        try {
                            if (p.description && typeof p.description === 'string') {
                                title = p.description.replace(/<[^>]*>?/gm, '');
                            }
                        } catch (err) { /* ignore description error */ }
                    }

                    let image = '';
                    if (p.image?.url) image = p.image.url;
                    else if (p.thumbnail?.url) image = p.thumbnail.url;
                    else if (p.small_image?.url) image = p.small_image.url;
                    else if (p.media_gallery?.length > 0) image = p.media_gallery[0].url;

                    let link = p.url_key ? `https://www.terminalx.com/${p.url_key}` : `https://www.terminalx.com/catalog/product/view/id/${p.id}`;

                    let brand = p.brand_name;
                    // SAFE BRAND EXTRACTION
                    try {
                        if (!brand && p.brand_url && typeof p.brand_url === 'string') {
                            brand = p.brand_url.split('/').pop().replace(/-/g, ' ').toUpperCase();
                        }
                    } catch (err) { /* ignore brand parse error */ }

                    if (!brand || !isNaN(brand)) brand = p.brand || 'Terminal X';

                    // Hardcoded fix for known Terminal X IDs
                    if (brand === '11636' || String(p.brand) === '11636') brand = 'NIKE';
                    if (brand === '11639' || String(p.brand) === '11639') brand = 'JORDAN';
                    if (brand === '11646' || String(p.brand) === '11646') brand = 'ADIDAS';
                    if (brand === '11649' || String(p.brand) === '11649') brand = 'NEW BALANCE';

                    const mapped = {
                        title: title,
                        price: price,
                        store: 'Terminal X',
                        link: link,
                        image: image,
                        brand: brand
                    };
                    mappedProducts.push(mapped);

                } catch (err) {
                    // Silent fail on individual item
                }
            }

            if (mappedProducts.length > 0) {
                console.log(`[TerminalX Debug] Mapped ${mappedProducts.length} items. First item:`, JSON.stringify(mappedProducts[0]));
            } else {
                console.log(`[TerminalX Debug] 0 items mapped. Raw count: ${productsRaw.length}`);
            }

            // --- USE SMART FILTER ---
            const filtered = SmartFilter.filter(mappedProducts, this.query);
            console.log(`[TerminalX] Final output: ${filtered.length} products.`);

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
