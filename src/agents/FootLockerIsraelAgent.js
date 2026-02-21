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
                        if (!data || !data.variants) return;
                        const key = data.handle || (data.id ? data.id.toString() : null);
                        if (!key) return;

                        let sizeOptionIndex = 0;
                        if (data.options && Array.isArray(data.options)) {
                            const sizeIdx = data.options.findIndex(opt =>
                                (typeof opt === 'string' ? opt : (opt.name || '')).toLowerCase().match(/size|מידה|גודל/)
                            );
                            if (sizeIdx >= 0) sizeOptionIndex = sizeIdx;
                        }

                        const optionKey = `option${sizeOptionIndex + 1}`;
                        const availableSizes = data.variants
                            .filter(v => v.available === true)
                            .map(v => v[optionKey] || v.title || '')
                            .filter(s => s && s.length < 12)
                            .map(s => s.replace(/^(US|EU|UK)\s*/i, '').trim());

                        if (availableSizes.length > 0) {
                            sizeMap[key] = availableSizes;
                            if (data.id) sizeMap[data.id.toString()] = availableSizes;
                        }
                    }

                    document.querySelectorAll('script[id*="product-json"], script[data-product-json], script[data-product-id]').forEach(s => {
                        try { extractShopifyProduct(JSON.parse(s.textContent)); } catch (e) { }
                    });

                    document.querySelectorAll('script[type="application/json"]').forEach(s => {
                        try {
                            const raw = s.textContent.trim();
                            if (!raw || raw.length < 20) return;
                            const data = JSON.parse(raw);
                            if (data && data.variants) extractShopifyProduct(data);
                            if (data && data.product && data.product.variants) extractShopifyProduct(data.product);
                            if (Array.isArray(data)) data.forEach(extractShopifyProduct);
                        } catch (e) { }
                    });

                    document.querySelectorAll('script:not([src])').forEach(s => {
                        const text = s.textContent || '';
                        if (text.includes('var meta =') || text.includes('product')) {
                            const jsonMatches = text.match(/\{[^{}]*"variants"\s*:\s*\[[\s\S]*?\]\s*[^{}]*\}/g);
                            if (jsonMatches) {
                                jsonMatches.forEach(m => {
                                    try { extractShopifyProduct(JSON.parse(m)); } catch (e) { }
                                });
                            }
                        }
                    });

                    const results = [];
                    const tiles = document.querySelectorAll('.product-item, .product-card');

                    tiles.forEach(tile => {
                        let productUrl = '';
                        let productHandle = '';
                        const allAnchors = [...tile.querySelectorAll('a')];
                        for (const a of allAnchors) {
                            const h = a.getAttribute('href') || '';
                            if (h.includes('/products/')) {
                                productUrl = h;
                                const handleMatch = h.match(/\/products\/([^?#]+)/);
                                if (handleMatch) productHandle = handleMatch[1];
                                break;
                            }
                        }
                        if (!productUrl) {
                            for (const a of allAnchors) {
                                const h = a.getAttribute('href') || '';
                                if (h && h !== '#' && h !== 'javascript:void(0)' && !h.startsWith('mailto:')) {
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
                            tile.getAttribute('data-infinator-id') ||
                            tile.getAttribute('id')?.replace('product-', '') ||
                            tile.querySelector('[data-product-id]')?.getAttribute('data-product-id') || '';

                        if (sizes.length === 0 && pid && sizeMap[pid]) sizes = sizeMap[pid];

                        if (sizes.length === 0) {
                            const altHandle = tile.getAttribute('data-handle') || tile.querySelector('[data-handle]')?.getAttribute('data-handle');
                            if (altHandle && sizeMap[altHandle]) sizes = sizeMap[altHandle];
                        }

                        if (sizes.length === 0) {
                            tile.querySelectorAll('[data-option*="size"], [class*="size"] button, [class*="size"] span, .variant-input input').forEach(el => {
                                let s = el.innerText.trim() || el.value || '';
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
                items.forEach(p => {
                    console.log(`[Foot Locker Israel] DEBUG: "${p.raw_title}" → Sizes: [${p.raw_sizes.join(', ')}]`);
                });
                resolve(items);
            } catch (err) {
                console.error(`[Foot Locker Israel] Scrape error: ${err.message}`);
                resolve([]);
            }
        });
    }
}

module.exports = FootLockerIsraelAgent;
