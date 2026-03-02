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

                // Collect product URLs from DOM fallback or API
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

                // Fetch PDP sizes in parallel batches (5 at a time) via in-browser fetch
                console.log(`[Nike Israel] Fetching sizes from ${productList.length} PDPs (parallel batches of 5)...`);
                const enriched = await this._fetchPDPSizesInBatches(productList, 5);

                resolve(enriched);
            } catch (err) {
                console.error(`[Nike Israel] Scrape error: ${err.message}`);
                resolve([]);
            }
        });
    }

    /**
     * Fetch PDP sizes for a batch of products using in-browser fetch calls (parallel).
     * This avoids navigating to each PDP separately and is much faster.
     */
    async _fetchPDPSizesInBatches(products, batchSize) {
        const results = [...products];
        for (let i = 0; i < results.length; i += batchSize) {
            const batch = results.slice(i, i + batchSize);
            const batchSizes = await this.page.evaluate(async (batchItems) => {
                async function fetchNikeSizes(url) {
                    if (!url || !url.includes('/t/')) return [];
                    try {
                        const res = await fetch(url, {
                            headers: { 'Accept': 'text/html', 'User-Agent': navigator.userAgent }
                        });
                        if (!res.ok) return [];
                        const html = await res.text();

                        // ── Step 1: ALL sizes from __NEXT_DATA__ ──
                        const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
                        if (!match) return [];
                        const data = JSON.parse(match[1]);
                        const sizesData = data?.props?.pageProps?.selectedProduct?.sizes || [];
                        const allSizes = sizesData
                            .map(s => (s.localizedLabel || s.label || '').replace(/^(EU|US|UK)\s*/i, '').trim())
                            .filter(s => s && /^\d/.test(s));
                        if (allSizes.length === 0) return [];

                        // ── Step 2: OOS detection from server-rendered HTML ──
                        // Nike SSR includes aria-disabled="true" on out-of-stock size inputs
                        const oosSet = new Set();

                        // Pass A: aria-disabled on input/button with value or label containing size
                        // e.g. ...aria-disabled="true" ... value="EU 35.5"...
                        const patA = /aria-disabled="true"[^>]{0,400}/g;
                        let m;
                        while ((m = patA.exec(html)) !== null) {
                            const fragment = m[0];
                            const numM = fragment.match(/\b(\d{2}(?:\.\d)?)\b/g) || [];
                            for (const cand of numM) {
                                if (allSizes.includes(cand)) oosSet.add(cand);
                            }
                        }

                        // Pass B: buttons/divs with "disabled" class + numeric label nearby
                        const patB = /class="[^"]*\bdisabled\b[^"]*"[^>]{0,200}/g;
                        while ((m = patB.exec(html)) !== null) {
                            const fragment = m[0];
                            const numM = fragment.match(/\b(\d{2}(?:\.\d)?)\b/g) || [];
                            for (const cand of numM) {
                                if (allSizes.includes(cand)) oosSet.add(cand);
                            }
                        }

                        // ── Step 3: Return only in-stock sizes ──
                        return oosSet.size > 0
                            ? allSizes.filter(s => !oosSet.has(s))
                            : allSizes;

                    } catch (e) {
                        return [];
                    }
                }

                const sizeResults = await Promise.all(batchItems.map(p => fetchNikeSizes(p.raw_url)));
                return sizeResults;
            }, batch.map(p => ({ raw_url: p.raw_url })));

            for (let j = 0; j < batch.length; j++) {
                const productIndex = i + j;
                if (batchSizes[j] && batchSizes[j].length > 0) {
                    results[productIndex].raw_sizes = [...new Set(batchSizes[j])];
                    console.log(`[Nike Israel] "${results[productIndex].raw_title}" → Sizes: [${results[productIndex].raw_sizes.join(', ')}]`);
                }
            }
        }
        return results;
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
