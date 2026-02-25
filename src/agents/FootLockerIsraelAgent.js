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
                    await this.page.waitForSelector('.scroll-swatch, .size-swatch, [class*="size"]', { timeout: 5000, visible: true }).catch(() => { });
                } catch (e) {
                    console.log('[Foot Locker Israel] Timeout waiting for specific elements.');
                }

                const products = await this.page.evaluate((baseDomain) => {
                    function norm(u) {
                        if (!u) return '';
                        u = u.trim();
                        if (u.startsWith('http')) return u;
                        if (u.startsWith('//')) return 'https:' + u;
                        if (u.startsWith('/') && !u.includes(baseDomain.replace('https://', ''))) return baseDomain + u;
                        if (u.startsWith('/')) return 'https:' + u;
                        return baseDomain + '/' + u;
                    }

                    const sizeMap = {};

                    function extractShopifyProduct(data) {
                        if (!data) return;
                        const p = data.product || data;
                        if (!p.variants) return;
                        const key = p.handle || (p.id ? p.id.toString() : null);
                        if (!key) return;

                        let sizeOptionIndex = 0;
                        if (p.options && Array.isArray(p.options)) {
                            const sizeIdx = p.options.findIndex(opt =>
                                (typeof opt === 'string' ? opt : (opt.name || '')).toLowerCase().match(/size|מידה|גודל/)
                            );
                            if (sizeIdx >= 0) sizeOptionIndex = sizeIdx;
                        }

                        const optionKey = `option${sizeOptionIndex + 1}`;
                        const availableSizes = p.variants
                            .filter(v => v.available === true)
                            .map(v => (v[optionKey] || v.title || '').replace(/^(US|EU|UK)\s*/i, '').trim())
                            .filter(s => s && s.length < 12);

                        if (availableSizes.length > 0) {
                            sizeMap[key] = availableSizes;
                            if (p.id) sizeMap[p.id.toString()] = availableSizes;
                        }
                    }

                    document.querySelectorAll('script[id*="product-json"], script[data-product-json], script[id*="ProductJson"]').forEach(s => {
                        try { extractShopifyProduct(JSON.parse(s.textContent)); } catch (e) { }
                    });

                    document.querySelectorAll('script[type="application/json"]').forEach(s => {
                        try {
                            const raw = s.textContent.trim();
                            if (!raw || raw.length < 20) return;
                            const data = JSON.parse(raw);
                            if (Array.isArray(data)) data.forEach(extractShopifyProduct);
                            else extractShopifyProduct(data);
                        } catch (e) { }
                    });

                    const results = [];
                    const tiles = document.querySelectorAll('.product-item, .product-card, .grid__item');

                    tiles.forEach(tile => {
                        let productUrl = '';
                        let productHandle = '';
                        const anchors = [...tile.querySelectorAll('a')];
                        for (const a of anchors) {
                            const h = a.getAttribute('href') || '';
                            if (h.includes('/products/')) {
                                productUrl = h;
                                const handleMatch = h.match(/\/products\/([^?#]+)/);
                                if (handleMatch) productHandle = handleMatch[1];
                                break;
                            }
                        }
                        if (!productUrl) return;
                        productUrl = norm(productUrl);

                        const vendorEl = tile.querySelector('.product-item-meta__vendor, [class*="vendor"]');
                        const brandName = vendorEl?.innerText?.trim() || '';

                        const titleEl = tile.querySelector('.product-item-meta__title, .product-item__title, h3, h2, [class*="title"]');
                        let title = titleEl?.innerText?.trim() || '';
                        if (brandName && !title.toUpperCase().includes(brandName.toUpperCase())) {
                            title = `${brandName} ${title}`;
                        }

                        const priceDataEl = tile.querySelector('[data-product-price], .price .money');
                        let priceText = priceDataEl?.getAttribute('data-product-price') || '';

                        // Fallback to text parsing if no attribute is found
                        if (!priceText) {
                            const priceEl = tile.querySelector('.price__current, .product-item__price, .price-item--regular, .price');
                            priceText = priceEl ? priceEl.innerText : (tile.innerText.match(/₪?\s?(\d{2,4}\.?\d{0,2})/) || [])[1] || '0';
                        }

                        const price = parseFloat(priceText.replace(/[^\d.]/g, '')) || 0;

                        const imgEl = tile.querySelector('img');
                        const rawImg = norm(imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || '');

                        let sizes = [];
                        if (productHandle && sizeMap[productHandle]) sizes = sizeMap[productHandle];

                        const pid = tile.getAttribute('data-product-id') ||
                            tile.getAttribute('data-id') ||
                            tile.querySelector('[data-product-id]')?.getAttribute('data-product-id') || '';

                        if (sizes.length === 0 && pid && sizeMap[pid]) sizes = sizeMap[pid];

                        if (sizes.length === 0) {
                            tile.querySelectorAll('.size-swatch, .scroll-swatch, [class*="size"], .variant-input input').forEach(el => {
                                let s = (el.innerText || el.value || '').trim();
                                if (s && !isNaN(parseFloat(s)) && s.length < 8) sizes.push(s);
                            });
                        }

                        if (title) {
                            results.push({
                                raw_title: title,
                                raw_price: price,
                                raw_url: productUrl,
                                raw_image_url: rawImg,
                                raw_sizes: [...new Set(sizes)]
                            });
                        }
                    });

                    return { results, sizeMapCount: Object.keys(sizeMap).length };
                }, domain);

                console.log(`[Foot Locker Israel] Found ${products.results.length} products (sizeMap: ${products.sizeMapCount})`);
                resolve(products.results);
            } catch (err) {
                console.error(`[Foot Locker Israel] Scrape error: ${err.message}`);
                resolve([]);
            }
        });
    }
}

module.exports = FootLockerIsraelAgent;
