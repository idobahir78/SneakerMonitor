const DOMNavigator = require('./DOMNavigator');

class FootLockerIsraelAgent extends DOMNavigator {
    constructor() {
        super('Foot Locker Israel', 'https://footlocker.co.il');
    }

    async scrape(brand, model) {
        const query = encodeURIComponent(`${brand} ${model}`);
        const searchUrl = `${this.targetUrl}/search?q=${query}`;

        return new Promise(async (resolve) => {
            try {
                console.log(`[Foot Locker Israel] Navigating to: ${searchUrl}`);
                await this.navigateWithRetry(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });

                try {
                    await this.page.waitForSelector('.product-item, .product-card, .grid__item', { timeout: 15000 });
                } catch (e) {
                    console.log('[Foot Locker Israel] Timeout waiting for product grid.');
                }

                // Step 1: Extract product cards + handles from DOM
                const rawProducts = await this.page.evaluate((baseDomain) => {
                    function norm(u) {
                        if (!u) return '';
                        u = u.trim();
                        if (u.startsWith('http')) return u;
                        if (u.startsWith('//')) return 'https:' + u;
                        if (u.startsWith('/')) return baseDomain + u;
                        return baseDomain + '/' + u;
                    }

                    const results = [];
                    const seen = new Set();
                    const tiles = document.querySelectorAll('.product-item, .product-card, .grid__item');

                    tiles.forEach(tile => {
                        let productUrl = '';
                        let productHandle = '';
                        for (const a of tile.querySelectorAll('a')) {
                            const h = a.getAttribute('href') || '';
                            if (h.includes('/products/')) {
                                productUrl = norm(h);
                                const m = h.match(/\/products\/([^?#/]+)/);
                                if (m) productHandle = m[1];
                                break;
                            }
                        }
                        if (!productUrl || !productHandle || seen.has(productHandle)) return;
                        seen.add(productHandle);

                        const vendorEl = tile.querySelector('.product-item-meta__vendor, [class*="vendor"]');
                        const brandName = vendorEl?.innerText?.trim() || '';

                        const titleEl = tile.querySelector('.product-item-meta__title, .product-item__title, h3, h2, [class*="title"]');
                        let title = titleEl?.innerText?.trim() || '';
                        if (brandName && !title.toUpperCase().includes(brandName.toUpperCase())) {
                            title = `${brandName} ${title}`;
                        }
                        if (!title) return;

                        // Price: priority selectors
                        let price = 0;
                        for (const sel of [
                            '[data-product-price]', '.price__current .money',
                            '.price .money', '.price-item--sale',
                            '.price-item--regular', '.price'
                        ]) {
                            const el = tile.querySelector(sel);
                            if (!el) continue;
                            const raw = el.getAttribute('data-product-price') || el.innerText || '';
                            const parsed = parseFloat(raw.replace(/[^\d.]/g, ''));
                            if (parsed > 0) { price = parsed; break; }
                        }
                        if (price === 0) {
                            const m = tile.innerText.match(/(\d{3,4}(?:\.\d{1,2})?)/);
                            if (m) price = parseFloat(m[1]) || 0;
                        }

                        const imgEl = tile.querySelector('img');
                        const rawImg = norm(imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || '');

                        results.push({ title, price, productUrl, productHandle, rawImg });
                    });

                    return results;
                }, this.targetUrl);

                console.log(`[Foot Locker Israel] Found ${rawProducts.length} products. Fetching sizes via same-origin fetch...`);

                // Step 2: Same-origin fetch to /products/{handle}.json from within footlocker.co.il page.
                // This is the only reliable approach: already on footlocker.co.il → same-origin request
                // → no Cloudflare block, no CSP restriction.
                const handles = rawProducts.map(p => p.productHandle);

                const sizeMap = await this.page.evaluate(async (handles) => {
                    const results = {};

                    async function fetchSizes(handle) {
                        try {
                            // Use .js endpoint (not .json) — it includes the `available` boolean per variant
                            const res = await fetch(`/products/${handle}.js`, {
                                credentials: 'include',
                                headers: { 'Accept': 'application/json' }
                            });
                            if (!res.ok) return [];
                            const product = await res.json(); // .js returns product directly (no `.product` wrapper)
                            if (!product?.variants) return [];

                            // Find which option index = size
                            let sizeOptIdx = 0;
                            if (product.options) {
                                const idx = product.options.findIndex(o => {
                                    const name = typeof o === 'string' ? o : (o.name || '');
                                    return /size|מידה|גודל/i.test(name);
                                });
                                if (idx >= 0) sizeOptIdx = idx;
                            }
                            const optKey = `option${sizeOptIdx + 1}`;

                            const sizes = product.variants
                                .filter(v => v.available === true)
                                .map(v => (v[optKey] || v.title || '').replace(/^(US|EU|UK)\s*/i, '').trim())
                                .filter(s => s && s.length < 12 && s !== 'Default Title');

                            return [...new Set(sizes)];
                        } catch (e) {
                            return [];
                        }
                    }

                    // Run all fetches in parallel (all same-origin, no rate limit concerns)
                    const sizesArr = await Promise.all(handles.map(h => fetchSizes(h)));
                    handles.forEach((h, i) => { results[h] = sizesArr[i]; });
                    return results;
                }, handles);

                // Step 3: Merge sizes into products
                const finalProducts = rawProducts.map(p => {
                    const raw_sizes = sizeMap[p.productHandle] || [];
                    if (raw_sizes.length > 0) {
                        console.log(`[Foot Locker Israel] "${p.title}" → Sizes: [${raw_sizes.join(', ')}]`);
                    } else {
                        console.log(`[Foot Locker Israel] "${p.title}" → Sizes: [] (no stock data)`);
                    }
                    return {
                        raw_title: p.title,
                        raw_price: p.price,
                        raw_url: p.productUrl,
                        raw_image_url: p.rawImg,
                        raw_sizes
                    };
                });

                console.log(`[Foot Locker Israel] Done: ${finalProducts.length} products.`);
                resolve(finalProducts);

            } catch (err) {
                console.error(`[Foot Locker Israel] Scrape error: ${err.message}`);
                resolve([]);
            }
        });
    }
}

module.exports = FootLockerIsraelAgent;
