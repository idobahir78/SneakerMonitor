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

                // === DIAGNOSTIC: Dump all JSON script tags to find where Shopify stores product data ===
                const jsonDiag = await this.page.evaluate(() => {
                    const scripts = document.querySelectorAll('script[type="application/json"]');
                    return [...scripts].map((s, i) => ({
                        index: i,
                        id: s.id || null,
                        dataProductId: s.getAttribute('data-product-id') || null,
                        dataProductJson: s.hasAttribute('data-product-json') ? true : null,
                        snippet: s.textContent.substring(0, 200)
                    }));
                });
                console.log(`[Foot Locker Israel] DEBUG: Found ${jsonDiag.length} script[type="application/json"] tags`);
                jsonDiag.forEach(s => {
                    console.log(`[Foot Locker Israel] JSON Script #${s.index}: id="${s.id}", data-product-id="${s.dataProductId}", data-product-json=${s.dataProductJson}, snippet="${s.snippet}"`);
                });

                // === DIAGNOSTIC: Check for product-item data attributes ===
                const tileAttrs = await this.page.evaluate(() => {
                    const tile = document.querySelector('.product-item');
                    if (!tile) return null;
                    const attrs = {};
                    for (const attr of tile.attributes) {
                        attrs[attr.name] = attr.value.substring(0, 100);
                    }
                    return attrs;
                });
                if (tileAttrs) {
                    console.log(`[Foot Locker Israel] DEBUG: First tile attributes: ${JSON.stringify(tileAttrs)}`);
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

                    // === Build size map from ALL Shopify JSON script tags ===
                    const sizeMap = {};
                    const allJsonScripts = document.querySelectorAll('script[type="application/json"]');
                    allJsonScripts.forEach(script => {
                        try {
                            const raw = script.textContent.trim();
                            if (!raw || raw.length < 10) return;
                            const data = JSON.parse(raw);

                            // Single product object with variants
                            if (data && data.variants && (data.handle || data.id)) {
                                const key = data.handle || data.id.toString();
                                const availableSizes = data.variants
                                    .filter(v => v.available === true)
                                    .map(v => v.option1 || v.title || '')
                                    .filter(s => s && s.length < 10);
                                if (availableSizes.length > 0) sizeMap[key] = availableSizes;
                            }

                            // Array of product objects
                            if (Array.isArray(data)) {
                                data.forEach(item => {
                                    if (item && item.variants && (item.handle || item.id)) {
                                        const key = item.handle || item.id.toString();
                                        const availableSizes = item.variants
                                            .filter(v => v.available === true)
                                            .map(v => v.option1 || v.title || '')
                                            .filter(s => s && s.length < 10);
                                        if (availableSizes.length > 0) sizeMap[key] = availableSizes;
                                    }
                                });
                            }

                            // Nested product data (sometimes under .product or .products)
                            if (data && data.product && data.product.variants) {
                                const p = data.product;
                                const key = p.handle || p.id?.toString() || '';
                                const availableSizes = p.variants
                                    .filter(v => v.available === true)
                                    .map(v => v.option1 || v.title || '')
                                    .filter(s => s && s.length < 10);
                                if (key && availableSizes.length > 0) sizeMap[key] = availableSizes;
                            }
                        } catch (e) { }
                    });

                    const results = [];
                    const tiles = document.querySelectorAll('.product-item');

                    tiles.forEach(tile => {
                        let productUrl = '';
                        let productHandle = '';
                        const allAnchors = [...tile.querySelectorAll('a')];
                        for (const a of allAnchors) {
                            const h = a.getAttribute('href') || '';
                            if (h.includes('/products/')) {
                                productUrl = h;
                                const handleMatch = h.match(/\/products\/([^?]+)/);
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

                        const titleEl = tile.querySelector('.product-item__title, .product-item__link, h3, h2, [class*="title"]');
                        const priceEl = tile.querySelector('.price__current, .product-item__price, .price .money, .price, .money');
                        const imgEl = tile.querySelector('.product-item__primary-image, img');

                        let title = titleEl?.innerText?.trim() || '';
                        if (!title && productUrl) {
                            const slug = productUrl.split('/products/')[1]?.split('?')[0] || '';
                            title = slug.replace(/-/g, ' ');
                        }

                        // === Size lookup by handle or product ID ===
                        let sizes = [];
                        if (productHandle && sizeMap[productHandle]) {
                            sizes = sizeMap[productHandle];
                        }
                        if (sizes.length === 0) {
                            const productId = tile.getAttribute('data-infinator-id') || tile.getAttribute('data-product-id') || '';
                            if (productId && sizeMap[productId]) {
                                sizes = sizeMap[productId];
                            }
                        }

                        if (title) {
                            let price = 0;
                            if (priceEl) {
                                const priceText = priceEl.innerText.replace(/[^\d.]/g, '');
                                price = parseFloat(priceText) || 0;
                            }
                            const rawImg = norm(imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || imgEl?.getAttribute('srcset')?.split(' ')[0] || '');

                            results.push({
                                raw_title: title,
                                raw_price: price,
                                raw_url: productUrl,
                                raw_image_url: rawImg,
                                raw_sizes: sizes
                            });
                        }
                    });

                    return { results, sizeMapKeys: Object.keys(sizeMap), sizeMapSample: Object.entries(sizeMap).slice(0, 2) };
                }, domain);

                console.log(`[Foot Locker Israel] DEBUG: sizeMap has ${products.sizeMapKeys.length} entries: [${products.sizeMapKeys.join(', ')}]`);
                if (products.sizeMapSample.length > 0) {
                    products.sizeMapSample.forEach(([key, sizes]) => {
                        console.log(`[Foot Locker Israel] DEBUG: Sizes for "${key}": [${sizes.join(', ')}]`);
                    });
                }

                const items = products.results;
                if (items.length === 0) {
                    console.error(`[Foot Locker Israel] DEBUG: 0 products.`);
                } else {
                    console.log(`[Foot Locker Israel] Found ${items.length} products`);
                    items.forEach(p => {
                        console.log(`[Foot Locker Israel] DEBUG: ${p.raw_title} → Sizes: [${p.raw_sizes.join(', ')}]`);
                    });
                }
                resolve(items);
            } catch (err) {
                console.error(`[Foot Locker Israel] Scrape error: ${err.message}`);
                resolve([]);
            }
        });
    }
}

module.exports = FootLockerIsraelAgent;
