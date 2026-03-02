const DOMNavigator = require('./DOMNavigator');

class NikeIsraelAgent extends DOMNavigator {
    constructor() {
        super('Nike Israel', 'https://www.nike.com/il');
    }

    async scrape(brand, model) {
        // Nike Israel only sells Nike/Jordan products
        if (brand.toLowerCase() !== 'nike' && brand.toLowerCase() !== 'jordan') return [];

        const q = encodeURIComponent(model);
        const searchUrl = `${this.targetUrl}/w?q=${q}&vst=${q}`;

        let interceptedItems = [];
        let apiDataCaptured = false;

        return new Promise(async (resolve) => {
            try {
                // Intercept Nike's search API responses
                this.page.on('response', async (response) => {
                    if (apiDataCaptured) return;
                    try {
                        const url = response.url();
                        if (
                            response.headers()['content-type']?.includes('application/json') &&
                            (url.includes('api.nike.com') || url.includes('wall') || url.includes('search'))
                        ) {
                            const data = await response.json();
                            const products = this._parseNikeResponse(data);
                            if (products.length > 0) {
                                interceptedItems = products;
                                apiDataCaptured = true;
                                console.log(`[Nike Israel] API intercepted: ${products.length} items`);
                            }
                        }
                    } catch (e) { }
                });

                console.log(`[Nike Israel] Navigating to: ${searchUrl}`);
                await this.navigateWithRetry(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await new Promise(r => setTimeout(r, 5000));

                // Collect product list from API or DOM fallback
                let productList = [];

                if (apiDataCaptured && interceptedItems.length > 0) {
                    productList = interceptedItems;
                } else {
                    try { await this.page.waitForSelector('[data-testid="product-card"]', { timeout: 10000 }); } catch (e) { }

                    const domProducts = await this.page.evaluate(() => {
                        const results = [];
                        document.querySelectorAll('[data-testid="product-card"]').forEach(tile => {
                            const titleEl = tile.querySelector('.product-card__title, [data-test="product-name"]');
                            const subtitleEl = tile.querySelector('.product-card__subtitle');
                            const priceEl = tile.querySelector('[data-test="product-price"], .product-price');
                            const linkEl = tile.querySelector('.product-card__link-overlay, a[href*="/t/"]');
                            const imgEl = tile.querySelector('img.product-card__hero-image, img');

                            if (titleEl) {
                                const priceText = priceEl?.innerText || '0';
                                const m = priceText.match(/(\d{2,5}\.?\d{0,2})/);
                                results.push({
                                    raw_title: `${titleEl.innerText.trim()} ${subtitleEl?.innerText?.trim() || ''}`.trim(),
                                    raw_price: m ? parseFloat(m[1]) : 0,
                                    raw_url: linkEl?.href || '',
                                    raw_image_url: imgEl?.src || imgEl?.getAttribute('data-src') || '',
                                    raw_sizes: []
                                });
                            }
                        });
                        return results;
                    });
                    productList = domProducts;
                    console.log(`[Nike Israel] Found ${productList.length} products via DOM`);
                }

                // Fetch accurate sizes by navigating PDPs in parallel browser tabs (hydration-aware)
                console.log(`[Nike Israel] Fetching sizes from ${productList.length} PDPs (parallel browser tabs, 3 at a time)...`);
                const enriched = await this._fetchPDPSizesViaBrowserTabs(productList, 3);

                resolve(enriched);
            } catch (err) {
                console.error(`[Nike Israel] Scrape error: ${err.message}`);
                resolve([]);
            }
        });
    }

    /**
     * Navigate to each Nike PDP in parallel Puppeteer tabs.
     * After React hydrates, reads the DOM for size selector items WITHOUT the "disabled" class.
     * This is the only reliable way to get OOS data since Nike uses CSR for size availability.
     *
     * Skips kids products (title contains "Kids'" or "Children") since size 44 is never in kids range,
     * leaving their raw_sizes as [] (they will be rejected by QA Sentinel anyway).
     */
    async _fetchPDPSizesViaBrowserTabs(products, concurrency) {
        const results = [...products];

        // Quick pre-filter: skip tabs for products that can never have size 44
        // Kids shoes max out at ~EU 40; navigating their PDPs is waste of time
        const needsNavigation = results.map((p, i) => {
            const title = (p.raw_title || '').toLowerCase();
            const isKids = /kids?'?s?|children|older kids|younger kids|teen/i.test(title);
            return { index: i, skip: isKids };
        });

        for (let i = 0; i < results.length; i += concurrency) {
            const batch = needsNavigation.slice(i, i + concurrency);

            await Promise.all(batch.map(async ({ index, skip }) => {
                const product = results[index];
                if (skip) {
                    // Kids product — still fetch sizes via quick __NEXT_DATA__ parse (no DOM needed)
                    results[index].raw_sizes = await this._fetchSizesFast(product.raw_url);
                    return;
                }

                let tab = null;
                try {
                    tab = await this.browser.newPage();
                    tab.setDefaultNavigationTimeout(20000);
                    tab.setDefaultTimeout(20000);
                    await tab.setUserAgent(this.getRandomUserAgent());

                    if (!product.raw_url || !product.raw_url.includes('/t/')) return;

                    await tab.goto(product.raw_url, { waitUntil: 'domcontentloaded', timeout: 20000 });

                    // Wait for React to hydrate and render size grid
                    try {
                        await tab.waitForSelector('[data-testid="pdp-grid-selector-item"]', { timeout: 10000 });
                    } catch (e) {
                        // Grid not found — fall back to __NEXT_DATA__ parse
                        results[index].raw_sizes = await this._fetchSizesFast(product.raw_url);
                        return;
                    }

                    // Extra 1.5s for fully hydration/OOS state rendering
                    await new Promise(r => setTimeout(r, 1500));

                    // Read only in-stock sizes: items WITHOUT the "disabled" class
                    const sizes = await tab.evaluate(() => {
                        const items = document.querySelectorAll(
                            '[data-testid="pdp-grid-selector-item"]:not(.disabled)'
                        );
                        const sizesArr = [];
                        items.forEach(item => {
                            const label = item.querySelector('label');
                            if (label) {
                                const text = label.innerText.trim()
                                    .replace(/^(EU|US|UK)\s*/i, '').trim();
                                if (text && /^\d/.test(text)) sizesArr.push(text);
                            }
                        });
                        return sizesArr;
                    });

                    results[index].raw_sizes = [...new Set(sizes)];
                    console.log(`[Nike Israel] "${product.raw_title}" → Sizes (DOM): [${results[index].raw_sizes.join(', ')}]`);

                } catch (e) {
                    console.warn(`[Nike Israel] PDP tab failed for "${product.raw_title}": ${e.message}`);
                    // Fallback to fast __NEXT_DATA__ parse
                    results[index].raw_sizes = await this._fetchSizesFast(product.raw_url);
                } finally {
                    if (tab) {
                        try { await tab.close(); } catch (_) { }
                    }
                }
            }));
        }

        return results;
    }

    /**
     * Fast fallback: fetch PDP HTML and parse __NEXT_DATA__ sizes.
     * Used for kids products and as error fallback. Returns all sizes (not OOS-filtered).
     */
    async _fetchSizesFast(url) {
        if (!url || !url.includes('/t/')) return [];
        try {
            const raw = await this.page.evaluate(async (u) => {
                const res = await fetch(u, { headers: { 'Accept': 'text/html' } });
                if (!res.ok) return '';
                return res.text();
            }, url);
            if (!raw) return [];

            const match = raw.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
            if (!match) return [];
            const data = JSON.parse(match[1]);
            const sizesData = data?.props?.pageProps?.selectedProduct?.sizes || [];
            return sizesData
                .map(s => (s.localizedLabel || s.label || '').replace(/^(EU|US|UK)\s*/i, '').trim())
                .filter(s => s && /^\d/.test(s));
        } catch (e) {
            return [];
        }
    }

    _parseNikeResponse(obj, depth = 0) {
        if (depth > 7 || !obj || typeof obj !== 'object') return [];
        let items = [];

        if (Array.isArray(obj)) {
            for (const item of obj) {
                if (item && (item.title || item.subtitle) && (item.price || item.currentPrice !== undefined)) {
                    const price = parseFloat(item.price?.currentPrice || item.currentPrice || item.price || 0);
                    if (price > 0) {
                        const raw_sizes = (
                            item.availableSkus ||
                            item.sizes ||
                            (item.colorways || []).flatMap(c => c.sizes || []) ||
                            []
                        ).filter(s => typeof s === 'object' ? s.available !== false : true)
                            .map(s => typeof s === 'object' ? (s.label || s.size || '') : s.toString())
                            .map(s => s.replace(/^(EU|US|UK)\s*/i, '').trim())
                            .filter(s => s && /^\d/.test(s));

                        items.push({
                            raw_title: `${item.title || ''} ${item.subtitle || ''}`.trim(),
                            raw_price: price,
                            raw_url: item.url || item.pdpUrl || '',
                            raw_image_url: item.image?.url || item.squarishURL || item.imageUrl || '',
                            raw_sizes
                        });
                    }
                } else {
                    items = items.concat(this._parseNikeResponse(item, depth + 1));
                }
            }
        } else {
            const searchKeys = ['objects', 'products', 'items', 'nodes', 'edges', 'data'];
            const found = searchKeys.find(k => obj[k]);
            if (found) {
                items = items.concat(this._parseNikeResponse(obj[found], depth + 1));
            } else {
                for (const key of Object.keys(obj)) {
                    if (!['settings', 'config', 'meta', 'analytics'].includes(key)) {
                        items = items.concat(this._parseNikeResponse(obj[key], depth + 1));
                    }
                }
            }
        }
        return items;
    }
}

module.exports = NikeIsraelAgent;
