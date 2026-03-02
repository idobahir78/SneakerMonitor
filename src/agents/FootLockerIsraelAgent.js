const https = require('https');
const DOMNavigator = require('./DOMNavigator');

class FootLockerIsraelAgent extends DOMNavigator {
    constructor() {
        super('Foot Locker Israel', 'https://footlocker.co.il');
    }

    /**
     * Server-side HTTPS request to Shopify product JSON endpoint.
     * Bypasses browser CSP restrictions entirely.
     */
    _fetchProductJson(handle) {
        return new Promise((resolve) => {
            const url = `https://footlocker.co.il/products/${handle}.json`;
            const options = {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            };

            https.get(url, options, (res) => {
                let raw = '';
                res.on('data', chunk => raw += chunk);
                res.on('end', () => {
                    try {
                        if (res.statusCode !== 200) return resolve([]);
                        const data = JSON.parse(raw);
                        const product = data.product;
                        if (!product || !product.variants) return resolve([]);

                        // Find which option index is the size
                        let sizeOptIdx = 0;
                        if (product.options) {
                            const idx = product.options.findIndex(o =>
                                (typeof o === 'string' ? o : (o.name || '')).toLowerCase().match(/size|מידה|גודל/)
                            );
                            if (idx >= 0) sizeOptIdx = idx;
                        }
                        const optKey = `option${sizeOptIdx + 1}`;

                        const sizes = product.variants
                            .filter(v => v.available === true)
                            .map(v => (v[optKey] || v.title || '').replace(/^(US|EU|UK)\s*/i, '').trim())
                            .filter(s => s && s.length < 12 && s !== 'Default Title');

                        resolve([...new Set(sizes)]);
                    } catch (e) {
                        resolve([]);
                    }
                });
            }).on('error', () => resolve([]));

            // Timeout safety: 8 seconds per product
            setTimeout(() => resolve([]), 8000);
        });
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

                // Step 1: Collect product handles + basic info from DOM
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

                        // Price: try multiple selectors in priority order
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

                        // Last resort: regex on entire tile text
                        if (price === 0) {
                            const m = tile.innerText.match(/(\d{2,4}(?:\.\d{1,2})?)/);
                            if (m) price = parseFloat(m[1]) || 0;
                        }

                        const imgEl = tile.querySelector('img');
                        const rawImg = norm(imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || '');

                        results.push({ title, price, productUrl, productHandle, rawImg });
                    });

                    return results;
                }, domain);

                console.log(`[Foot Locker Israel] Found ${rawProducts.length} products in DOM. Fetching sizes via Node.js HTTPS...`);

                // Step 2: Server-side HTTPS calls to /products/{handle}.json (bypasses Shopify CSP)
                const finalProducts = [];
                for (const p of rawProducts) {
                    const raw_sizes = await this._fetchProductJson(p.productHandle);

                    finalProducts.push({
                        raw_title: p.title,
                        raw_price: p.price,
                        raw_url: p.productUrl,
                        raw_image_url: p.rawImg,
                        raw_sizes
                    });

                    if (raw_sizes.length > 0) {
                        console.log(`[Foot Locker Israel] "${p.title}" → Sizes: [${raw_sizes.join(', ')}]`);
                    }
                }

                console.log(`[Foot Locker Israel] Final: ${finalProducts.length} products with sizes resolved.`);
                resolve(finalProducts);

            } catch (err) {
                console.error(`[Foot Locker Israel] Scrape error: ${err.message}`);
                resolve([]);
            }
        });
    }
}

module.exports = FootLockerIsraelAgent;
