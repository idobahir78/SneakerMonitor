const DOMNavigator = require('./DOMNavigator');

class FootLockerIsraelAgent extends DOMNavigator {
    constructor() {
        super('Foot Locker Israel', 'https://footlocker.co.il');
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
                    await this.page.waitForSelector('.product-item, .product-card', { timeout: 15000 });
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
                                const m = h.match(/\/products\/([^?#]+)/);
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

                        const priceEl = tile.querySelector('[data-product-price], .price .money, .price__current, .price-item--regular');
                        const priceText = priceEl?.getAttribute('data-product-price') || priceEl?.innerText || '0';
                        const price = parseFloat(priceText.replace(/[^\d.]/g, '')) || 0;

                        const imgEl = tile.querySelector('img');
                        const rawImg = norm(imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || '');

                        results.push({ title, price, productUrl, productHandle, rawImg });
                    });

                    return results;
                }, domain);

                console.log(`[Foot Locker Israel] Found ${rawProducts.length} products in DOM. Fetching sizes via API...`);

                // Step 2: For each product, fetch /products/{handle}.json to get available sizes
                const finalProducts = [];
                for (const p of rawProducts) {
                    try {
                        const apiUrl = `${domain}/products/${p.productHandle}.json`;
                        const raw_sizes = await this.page.evaluate(async (url) => {
                            try {
                                const res = await fetch(url);
                                if (!res.ok) return [];
                                const data = await res.json();
                                const product = data.product;
                                if (!product || !product.variants) return [];

                                // Find the size option index
                                let sizeOptIdx = 0;
                                if (product.options) {
                                    const idx = product.options.findIndex(o =>
                                        (typeof o === 'string' ? o : (o.name || '')).toLowerCase().match(/size|מידה|גודל/)
                                    );
                                    if (idx >= 0) sizeOptIdx = idx;
                                }
                                const optKey = `option${sizeOptIdx + 1}`;

                                return product.variants
                                    .filter(v => v.available === true)
                                    .map(v => (v[optKey] || v.title || '').replace(/^(US|EU|UK)\s*/i, '').trim())
                                    .filter(s => s && s.length < 12 && s !== 'Default Title');
                            } catch (e) {
                                return [];
                            }
                        }, apiUrl);

                        finalProducts.push({
                            raw_title: p.title,
                            raw_price: p.price,
                            raw_url: p.productUrl,
                            raw_image_url: p.rawImg,
                            raw_sizes: [...new Set(raw_sizes)]
                        });

                        if (raw_sizes.length > 0) {
                            console.log(`[Foot Locker Israel] "${p.title}" → Sizes: [${raw_sizes.join(', ')}]`);
                        }
                    } catch (err) {
                        // If API call fails for a single product, include it without sizes
                        finalProducts.push({
                            raw_title: p.title,
                            raw_price: p.price,
                            raw_url: p.productUrl,
                            raw_image_url: p.rawImg,
                            raw_sizes: []
                        });
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
