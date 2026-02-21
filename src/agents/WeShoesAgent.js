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
                await this.navigateWithRetry(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

                try {
                    await this.page.waitForSelector('.product-card, .grid__item, .product-item, [class*="product"]', { timeout: 20000 });
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

                    // ========================================
                    // SHOPIFY SIZE MAP — same DNA as FootLocker
                    // ========================================
                    const sizeMap = {};

                    function processShopifyProduct(data) {
                        if (!data || !data.variants) return;
                        const key = data.handle || (data.id ? data.id.toString() : null);
                        if (!key) return;

                        // Find the "Size" option index — not Color/Colour/Material
                        let sizeOptionIndex = 0;
                        if (data.options && Array.isArray(data.options)) {
                            const idx = data.options.findIndex(opt => {
                                const name = typeof opt === 'string' ? opt : (opt.name || '');
                                return /size|מידה|גודל/i.test(name);
                            });
                            if (idx >= 0) sizeOptionIndex = idx;
                        }
                        const optKey = `option${sizeOptionIndex + 1}`;

                        const availableSizes = data.variants
                            .filter(v => v.available === true)
                            .map(v => (v[optKey] || v.title || '').replace(/^(US|EU|UK)\s*/i, '').trim())
                            .filter(s => s && s.length < 12);

                        if (availableSizes.length > 0) sizeMap[key] = availableSizes;
                    }

                    // Source 1: script tags with product-specific IDs
                    document.querySelectorAll('script[id*="ProductJson"], script[id*="product-json"], script[data-product-id]').forEach(s => {
                        try { processShopifyProduct(JSON.parse(s.textContent)); } catch (e) { }
                    });

                    // Source 2: all application/json script tags
                    document.querySelectorAll('script[type="application/json"]').forEach(s => {
                        try {
                            const raw = s.textContent.trim();
                            if (!raw || raw.length < 20) return;
                            const data = JSON.parse(raw);
                            if (data && data.variants) processShopifyProduct(data);
                            if (data && data.product && data.product.variants) processShopifyProduct(data.product);
                            if (Array.isArray(data)) data.forEach(processShopifyProduct);
                        } catch (e) { }
                    });

                    // Source 3: inline scripts containing variant data
                    document.querySelectorAll('script:not([src])').forEach(s => {
                        const text = s.textContent || '';
                        if (!text.includes('"variants"')) return;
                        const matches = text.match(/\{[^{}]*"variants"\s*:\s*\[[\s\S]{0,5000}?\]\s*[^{}]*\}/g);
                        if (matches) matches.forEach(m => { try { processShopifyProduct(JSON.parse(m)); } catch (e) { } });
                    });

                    // ========================================
                    // TILE EXTRACTION
                    // ========================================
                    const results = [];

                    // WeShoes uses multiple possible product card selectors
                    const tileSelectors = [
                        '.product-card', '.grid__item', '.product-item',
                        '[class*="product-card"]', '[class*="product_card"]',
                        '.collection-product', '.card-wrapper'
                    ];
                    let tiles = [];
                    for (const sel of tileSelectors) {
                        tiles = [...document.querySelectorAll(sel)].filter(el =>
                            el.querySelector('a') && (el.querySelector('[class*="price"]') || el.querySelector('.price'))
                        );
                        if (tiles.length > 0) break;
                    }

                    tiles.forEach(tile => {
                        // URL + Handle
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
                        if (!productUrl && anchors.length > 0) {
                            productUrl = norm(anchors[0].getAttribute('href') || '');
                        }

                        // Title
                        const titleEl = tile.querySelector(
                            '.card__heading, .product-card__title, .product-card__name, ' +
                            '[class*="title"] a, [class*="name"] a, h2 a, h3 a, h3, h2, ' +
                            '.product-item__title, .full-unstyled-link'
                        );
                        let title = titleEl?.innerText?.trim() || '';
                        if (!title && productHandle) {
                            title = productHandle.replace(/-/g, ' ');
                        }

                        // Normalize HOKA brand names
                        title = title
                            .replace(/הוקה\s*/gi, 'HOKA ')
                            .replace(/HOKA ONE ONE/gi, 'HOKA')
                            .trim();

                        // Price
                        const priceEl = tile.querySelector(
                            '.price__regular .price-item, .price .money, .price__current, ' +
                            '[class*="price"] .money, .price-item--regular, .price'
                        );
                        let price = 0;
                        if (priceEl) {
                            price = parseFloat(priceEl.innerText.replace(/[^\d.]/g, '')) || 0;
                        }

                        // Image
                        const imgEl = tile.querySelector('img');
                        const imgSrc = norm(
                            imgEl?.getAttribute('src') ||
                            imgEl?.getAttribute('data-src') ||
                            imgEl?.getAttribute('data-srcset')?.split(' ')[0] ||
                            imgEl?.getAttribute('srcset')?.split(',')[0]?.trim()?.split(' ')[0] || ''
                        );

                        // Sizes — look up by handle then by product-id data attr
                        let sizes = [];
                        if (productHandle && sizeMap[productHandle]) sizes = sizeMap[productHandle];
                        if (sizes.length === 0) {
                            const pid = tile.getAttribute('data-id') || tile.getAttribute('data-product-id') || '';
                            if (pid && sizeMap[pid]) sizes = sizeMap[pid];
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
                items.forEach(p => {
                    console.log(`[WeShoes] DEBUG: "${p.raw_title}" → Sizes: [${p.raw_sizes.join(', ')}]`);
                });
                resolve(items);

            } catch (err) {
                console.error(`[WeShoes] Scrape error: ${err.message}`);
                resolve([]);
            }
        });
    }
}

module.exports = WeShoesAgent;
