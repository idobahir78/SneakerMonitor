const DOMNavigator = require('./DOMNavigator');

class FootLockerIsraelAgent extends DOMNavigator {
    constructor() {
        super('Foot Locker Israel', 'https://footlocker.co.il');
    }

    /**
     * Fetch product JSON using the Puppeteer browser page (uses existing session/cookies).
     * This bypasses Cloudflare and Shopify CSP that block plain Node.js https requests.
     */
    async _fetchProductJsonViaBrowser(handle) {
        const apiUrl = `${this.targetUrl}/products/${handle}.json`;
        let jsonPage = null;
        try {
            jsonPage = await this.browser.newPage();
            jsonPage.setDefaultNavigationTimeout(12000);
            jsonPage.setDefaultTimeout(12000);

            // Match the same User-Agent to avoid fingerprint mismatch
            await jsonPage.setUserAgent(this.getRandomUserAgent());

            const res = await jsonPage.goto(apiUrl, { waitUntil: 'domcontentloaded', timeout: 12000 });
            if (!res || res.status() !== 200) return [];

            const raw = await jsonPage.evaluate(() => document.body.innerText);
            const data = JSON.parse(raw);
            const product = data.product;
            if (!product || !product.variants) return [];

            // Find which option index corresponds to "size"
            let sizeOptIdx = 0;
            if (product.options) {
                const idx = product.options.findIndex(o => {
                    const name = typeof o === 'string' ? o : (o.name || '');
                    return name.toLowerCase().match(/size|מידה|גודל/);
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
        } finally {
            if (jsonPage) {
                try { await jsonPage.close(); } catch (_) { }
            }
        }
    }

    async scrape(brand, model) {
        const query = encodeURIComponent(`${brand} ${model}`);
        const searchUrl = `${this.targetUrl}/search?q=${query}`;
        const domain = this.targetUrl;

        return new Promise(async (resolve) => {
            try {
                console.log(`[Foot Locker Israel] Navigating to: ${searchUrl}`);
                await this.navigateWithRetry(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });

                try {
                    await this.page.waitForSelector('.product-item, .product-card, .grid__item', { timeout: 15000 });
                } catch (e) {
                    console.log('[Foot Locker Israel] Timeout waiting for product grid.');
                }

                // Step 1: Extract product cards from DOM
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
                        if (!productUrl || !productHandle) return;

                        const vendorEl = tile.querySelector('.product-item-meta__vendor, [class*="vendor"]');
                        const brandName = vendorEl?.innerText?.trim() || '';

                        const titleEl = tile.querySelector('.product-item-meta__title, .product-item__title, h3, h2, [class*="title"]');
                        let title = titleEl?.innerText?.trim() || '';
                        if (brandName && !title.toUpperCase().includes(brandName.toUpperCase())) {
                            title = `${brandName} ${title}`;
                        }
                        if (!title) return;

                        // Price: priority-ordered selectors
                        let price = 0;
                        const priceSelectors = [
                            '[data-product-price]',
                            '.price__current .money',
                            '.price .money',
                            '.price-item--sale',
                            '.price-item--regular',
                            '.price'
                        ];
                        for (const sel of priceSelectors) {
                            const el = tile.querySelector(sel);
                            if (!el) continue;
                            const raw = el.getAttribute('data-product-price') || el.innerText || '';
                            const cleaned = raw.replace(/[^\d.]/g, '');
                            const parsed = parseFloat(cleaned);
                            if (parsed > 0) { price = parsed; break; }
                        }
                        // Last resort: regex on tile text
                        if (price === 0) {
                            const m = tile.innerText.match(/(\d{3,4}(?:\.\d{1,2})?)/);
                            if (m) price = parseFloat(m[1]) || 0;
                        }

                        const imgEl = tile.querySelector('img');
                        const rawImg = norm(imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || '');

                        results.push({ title, price, productUrl, productHandle, rawImg });
                    });

                    return results;
                }, domain);

                console.log(`[Foot Locker Israel] Found ${rawProducts.length} products. Fetching sizes via browser tabs...`);

                // Step 2: Open new browser tabs to fetch Shopify product JSON (bypasses CSP + Cloudflare)
                const finalProducts = [];
                for (const p of rawProducts) {
                    const raw_sizes = await this._fetchProductJsonViaBrowser(p.productHandle);

                    finalProducts.push({
                        raw_title: p.title,
                        raw_price: p.price,
                        raw_url: p.productUrl,
                        raw_image_url: p.rawImg,
                        raw_sizes
                    });

                    if (raw_sizes.length > 0) {
                        console.log(`[Foot Locker Israel] "${p.title}" → Sizes: [${raw_sizes.join(', ')}]`);
                    } else {
                        console.log(`[Foot Locker Israel] "${p.title}" → Sizes: [] (unavailable or blocked)`);
                    }
                }

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
