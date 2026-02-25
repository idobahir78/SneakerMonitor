const DOMNavigator = require('./DOMNavigator');

class WeShoesAgent extends DOMNavigator {
    constructor() {
        super('WeShoes', 'https://www.weshoes.co.il');
    }

    async scrape(brand, model) {
        const query = encodeURIComponent(`${brand} ${model}`);
        const searchUrl = `${this.targetUrl}/search?q=${query}&type=product`;
        const domain = this.targetUrl;

        return new Promise(async (resolve) => {
            try {
                console.log(`[WeShoes] Navigating to: ${searchUrl}`);
                await this.navigateWithRetry(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });

                await new Promise(r => setTimeout(r, 2000));

                try {
                    await this.page.waitForSelector('.product-card, .grid__item, .product-item, [class*="product"]', { timeout: 15000 });
                } catch (e) {
                    console.log('[WeShoes] Timeout waiting for product grid.');
                }

                const products = await this.page.evaluate((baseDomain) => {
                    function norm(u) {
                        if (!u) return '';
                        u = u.trim();
                        if (u.startsWith('http')) return u;
                        if (u.startsWith('//')) return 'https:' + u;
                        if (u.startsWith('/')) return baseDomain + u;
                        return baseDomain + '/' + u;
                    }

                    const sizeMap = {};

                    function processShopifyProduct(data) {
                        if (!data) return;
                        const p = data.product || data;
                        if (!p.variants) return;

                        const key = p.handle || (p.id ? p.id.toString() : null);
                        if (!key) return;

                        let sizeOptionIndex = 0;
                        if (p.options && Array.isArray(p.options)) {
                            const idx = p.options.findIndex(opt => {
                                const name = typeof opt === 'string' ? opt : (opt.name || '');
                                return /size|מידה|גודל/i.test(name);
                            });
                            if (idx >= 0) sizeOptionIndex = idx;
                        }
                        const optKey = `option${sizeOptionIndex + 1}`;

                        const availableSizes = p.variants
                            .filter(v => v.available === true)
                            .map(v => (v[optKey] || v.title || '').replace(/^(US|EU|UK)\s*/i, '').trim())
                            .filter(s => s && s.length < 12);

                        if (availableSizes.length > 0) sizeMap[key] = availableSizes;
                    }

                    document.querySelectorAll('script[data-product-json], script[id*="ProductJson"], script[id*="product-json"]').forEach(s => {
                        try { processShopifyProduct(JSON.parse(s.textContent)); } catch (e) { }
                    });

                    document.querySelectorAll('script[type="application/json"]').forEach(s => {
                        try {
                            const raw = s.textContent.trim();
                            if (!raw || raw.length < 20) return;
                            const data = JSON.parse(raw);
                            if (data.variants || data.product?.variants) processShopifyProduct(data);
                        } catch (e) { }
                    });

                    if (window.product && window.product.variants) processShopifyProduct(window.product);
                    if (window.Shopify?.content?.product) processShopifyProduct(window.Shopify.content.product);

                    const results = [];
                    const tiles = document.querySelectorAll('.product-card, .grid__item, .product-item, .collection-product');

                    tiles.forEach(tile => {
                        let productUrl = '';
                        let productHandle = '';
                        const anchors = [...tile.querySelectorAll('a')];
                        for (const a of anchors) {
                            const h = a.getAttribute('href') || '';
                            if (h.includes('/products/')) {
                                productUrl = norm(h);
                                const m = h.match(/\/products\/([^?#]+)/);
                                if (m) productHandle = m[1];
                                break;
                            }
                        }

                        const titleEl = tile.querySelector('.card__heading, .product-card__title, .product-item__title, h3, h2');
                        let title = titleEl?.innerText?.trim() || '';

                        title = title.replace(/הוקה\s*/gi, 'HOKA ').replace(/HOKA ONE ONE/gi, 'HOKA').trim();

                        const priceEl = tile.querySelector('.price-item--regular, .price__regular .price-item, .price .money, .price');
                        const price = priceEl ? parseFloat(priceEl.innerText.replace(/[^\d.]/g, '')) : 0;

                        const imgEl = tile.querySelector('img');
                        const imgSrc = norm(imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || '');

                        let sizes = [];
                        if (productHandle && sizeMap[productHandle]) sizes = sizeMap[productHandle];

                        if (sizes.length === 0) {
                            tile.querySelectorAll('.qb-size-item:not(.not-available)').forEach(el => {
                                const sizeText = el.innerText?.trim();
                                if (sizeText && !isNaN(parseFloat(sizeText)) && sizeText.length < 8) {
                                    sizes.push(sizeText);
                                }
                            });
                        }

                        if (title) {
                            results.push({
                                raw_title: title,
                                raw_price: price,
                                raw_url: productUrl,
                                raw_image_url: imgSrc,
                                raw_sizes: sizes
                            });
                        }
                    });

                    return { results, sizeMapCount: Object.keys(sizeMap).length };
                }, domain);

                const items = products.results;
                console.log(`[WeShoes] Found ${items.length} products, sizeMap: ${products.sizeMapCount} entries`);
                resolve(items);

            } catch (err) {
                console.error(`[WeShoes] Scrape error: ${err.message}`);
                resolve([]);
            }
        });
    }
}

module.exports = WeShoesAgent;
