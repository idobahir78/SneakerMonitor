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

                    // === Build size map from Shopify JSON script tags ===
                    const sizeMap = {};
                    document.querySelectorAll('script[type="application/json"]').forEach(script => {
                        try {
                            const raw = script.textContent.trim();
                            if (!raw || raw.length < 10) return;
                            const data = JSON.parse(raw);

                            const processProduct = (p) => {
                                if (!p || !p.variants) return;
                                const key = p.handle || (p.id ? p.id.toString() : null);
                                if (!key) return;
                                const availableSizes = p.variants
                                    .filter(v => v.available === true)
                                    .map(v => v.option1 || v.title || '')
                                    .filter(s => s && s.length < 10);
                                if (availableSizes.length > 0) sizeMap[key] = availableSizes;
                            };

                            if (data && data.variants) processProduct(data);
                            if (data && data.product && data.product.variants) processProduct(data.product);
                            if (Array.isArray(data)) data.forEach(processProduct);
                        } catch (e) { }
                    });

                    const results = [];
                    const tiles = document.querySelectorAll('.product-item');

                    tiles.forEach(tile => {
                        // === URL EXTRACTION ===
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

                        // === BRAND EXTRACTION from .product-item-meta__vendor ===
                        const vendorEl = tile.querySelector('.product-item-meta__vendor, [class*="vendor"]');
                        const brandName = vendorEl?.innerText?.trim() || '';

                        // === TITLE EXTRACTION — prepend brand if not already in title ===
                        const titleEl = tile.querySelector('.product-item-meta__title, .product-item__title, h3, h2, [class*="title"]');
                        let rawTitle = titleEl?.innerText?.trim() || '';
                        if (!rawTitle && productUrl) {
                            const slug = productUrl.split('/products/')[1]?.split('?')[0] || '';
                            rawTitle = slug.replace(/-/g, ' ');
                        }

                        // Prepend brand to title if brand exists and title doesn't already contain it
                        let title = rawTitle;
                        if (brandName && !rawTitle.toUpperCase().includes(brandName.toUpperCase())) {
                            title = `${brandName} ${rawTitle}`;
                        }

                        // === PRICE ===
                        const priceEl = tile.querySelector('.price__current, .product-item__price, .price .money, .price, .money');
                        let price = 0;
                        if (priceEl) {
                            const priceText = priceEl.innerText.replace(/[^\d.]/g, '');
                            price = parseFloat(priceText) || 0;
                        }

                        // === IMAGE ===
                        const imgEl = tile.querySelector('.product-item__primary-image, img');
                        const rawImg = norm(imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || imgEl?.getAttribute('srcset')?.split(' ')[0] || '');

                        // === SIZE LOOKUP ===
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
                            results.push({
                                raw_title: title,
                                raw_price: price,
                                raw_url: productUrl,
                                raw_image_url: rawImg,
                                raw_sizes: sizes
                            });
                        }
                    });

                    return { results, sizeMapKeys: Object.keys(sizeMap).length };
                }, domain);

                const items = products.results;
                console.log(`[Foot Locker Israel] DEBUG: sizeMap has ${products.sizeMapKeys} entries`);

                if (items.length === 0) {
                    console.error(`[Foot Locker Israel] DEBUG: 0 products.`);
                } else {
                    console.log(`[Foot Locker Israel] Found ${items.length} products`);
                    items.forEach(p => {
                        console.log(`[Foot Locker Israel] DEBUG: "${p.raw_title}" → Sizes: [${p.raw_sizes.join(', ')}]`);
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
