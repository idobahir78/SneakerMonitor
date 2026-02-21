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
                await this.navigateWithRetry(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

                try {
                    await this.page.waitForSelector('.product-item, .product-card', { timeout: 30000 });
                } catch (e) {
                    console.log('[Foot Locker Israel] Timeout waiting for product containers.');
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
                        if (!productUrl) {
                            for (const a of anchors) {
                                const h = a.getAttribute('href') || '';
                                if (h && h !== '#' && !h.startsWith('javascript')) {
                                    productUrl = h;
                                    break;
                                }
                            }
                        }
                        productUrl = norm(productUrl);

                        const vendorEl = tile.querySelector('.product-item-meta__vendor, [class*="vendor"]');
                        const brandName = vendorEl?.innerText?.trim() || '';

                        const titleEl = tile.querySelector('.product-item-meta__title, .product-item__title, h3, h2, [class*="title"]');
                        let rawTitle = titleEl?.innerText?.trim() || '';
                        if (!rawTitle && productUrl) {
                            const slug = productUrl.split('/products/')[1]?.split('?')[0] || '';
                            rawTitle = slug.replace(/-/g, ' ');
                        }
                        let title = rawTitle;
                        if (brandName && !rawTitle.toUpperCase().includes(brandName.toUpperCase())) {
                            title = `${brandName} ${rawTitle}`;
                        }

                        const priceEl = tile.querySelector('.price__current, .product-item__price, .price .money, .price, .money');
                        let price = 0;
                        if (priceEl) {
                            const priceText = priceEl.innerText.replace(/[^\d.]/g, '');
                            price = parseFloat(priceText) || 0;
                        }

                        const imgEl = tile.querySelector('.product-item__primary-image, img');
                        const rawImg = norm(imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || imgEl?.getAttribute('srcset')?.split(' ')[0] || '');

                        let sizes = [];
                        if (productHandle && sizeMap[productHandle]) sizes = sizeMap[productHandle];

                        const pid = tile.getAttribute('data-product-id') ||
                            tile.getAttribute('data-id') ||
                            tile.getAttribute('id')?.replace('product-', '') ||
                            tile.querySelector('[data-product-id]')?.getAttribute('data-product-id') || '';

                        if (sizes.length === 0 && pid && sizeMap[pid]) sizes = sizeMap[pid];

                        if (sizes.length === 0) {
                            const altHandle = tile.getAttribute('data-handle') || tile.querySelector('[data-handle]')?.getAttribute('data-handle');
                            if (altHandle && sizeMap[altHandle]) sizes = sizeMap[altHandle];
                        }

                        if (sizes.length === 0) {
                            tile.querySelectorAll('[data-option*="size"], [class*="variant"] button, [class*="size"] span, .variant-input input').forEach(el => {
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

                const items = products.results;
                console.log(`[Foot Locker Israel] Found ${items.length} products, sizeMap: ${products.sizeMapCount} entries`);
                resolve(items);
            } catch (err) {
                console.error(`[Foot Locker Israel] Scrape error: ${err.message}`);
                resolve([]);
            }
        });
    }
}

module.exports = FootLockerIsraelAgent;
