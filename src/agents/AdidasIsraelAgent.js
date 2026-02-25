const DOMNavigator = require('./DOMNavigator');

class AdidasIsraelAgent extends DOMNavigator {
    constructor() {
        super('Adidas Israel', 'https://www.adidas.co.il/he');
    }

    async scrape(brand, model) {
        if (brand.toLowerCase() !== 'adidas' && brand.toLowerCase() !== 'yeezy') return [];
        const query = encodeURIComponent(`${brand} ${model}`);
        const searchUrl = `${this.targetUrl}/search?q=${query}`;

        let interceptedItems = [];
        let apiDataCaptured = false;

        return new Promise(async (resolve) => {
            try {
                // Intercept XHR/Fetch JSON responses to bypass DOM-based bot protections
                this.page.on('response', async (response) => {
                    if (apiDataCaptured) return;
                    try {
                        const url = response.url().toLowerCase();
                        if (response.headers()['content-type']?.includes('application/json') &&
                            (url.includes('api') || url.includes('search') || url.includes('graphql'))) {
                            const data = await response.json();
                            const products = this.findAdidasProducts(data);

                            if (products && products.length > 0) {
                                interceptedItems = interceptedItems.concat(products);
                                apiDataCaptured = true;
                                console.log(`[Adidas Israel] Successfully intercepted API response with ${products.length} items`);
                            }
                        }
                    } catch (e) { }
                });

                await this.navigateWithRetry(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

                // Wait for potential API calls
                await new Promise(r => setTimeout(r, 4000));

                if (apiDataCaptured && interceptedItems.length > 0) {
                    return resolve(interceptedItems);
                }

                // Fallback to DOM if API intercept fails
                try { await this.page.waitForSelector('.product-card, .grid-item', { timeout: 10000 }); } catch (e) { }
                await new Promise(r => setTimeout(r, 1000));

                const domProducts = await this.page.evaluate(() => {
                    const results = [];
                    const tiles = document.querySelectorAll('.product-card, .grid-item, .products-item, .product');

                    tiles.forEach(tile => {
                        // Extract from data-tracking JSON if available
                        const trackingStr = tile.getAttribute('data-tracking-product-tile') || '{}';
                        let trackingObj = {};
                        try { trackingObj = JSON.parse(trackingStr); } catch (e) { }

                        const titleEl = tile.querySelector('.product-card-title, .product-name');
                        const priceEl = tile.querySelector('.product-price, .price-display, .sales .value');
                        const linkEl = tile.querySelector('a.product-card-link') || tile.querySelector('a.link') || tile.querySelector('a');
                        const imgEl = tile.querySelector('img.product-card-image, img.tile-image');

                        const rawTitle = trackingObj.product_name || (titleEl ? titleEl.innerText.trim() : '');

                        // Parse price from JSON, fallback to exact digits regex from text
                        let rawPrice = parseFloat(trackingObj.product_price) || 0;
                        if (!rawPrice && priceEl) {
                            const priceText = priceEl.getAttribute('content') || priceEl.innerText || '0';
                            const priceMatch = priceText.match(/(\d{2,4}\.?\d{0,2})/);
                            rawPrice = priceMatch ? parseFloat(priceMatch[1]) : 0;
                        }

                        if (rawTitle && rawPrice > 0) {
                            results.push({
                                raw_title: rawTitle,
                                raw_price: rawPrice,
                                raw_url: linkEl?.href || '',
                                raw_image_url: imgEl?.src || imgEl?.getAttribute('data-src') || ''
                            });
                        }
                    });
                    return results;
                });

                if (domProducts.length === 0 && interceptedItems.length === 0) {
                    console.error(`[Adidas Israel] DEBUG: Blocked by security or DEBUG: Empty response. 0 products found.`);
                } else {
                    console.log(`[Adidas Israel] Found ${domProducts.length} products via DOM fallback`);
                }

                resolve(interceptedItems.length > 0 ? interceptedItems : domProducts);
            } catch (err) {
                console.error(`[Adidas Israel] Scrape error: ${err.message}`);
                resolve([]);
            }
        });
    }

    findAdidasProducts(obj, depth = 0) {
        if (depth > 6 || !obj || typeof obj !== 'object') return [];
        let items = [];

        // Characteristic Adidas API structure checks
        if (Array.isArray(obj)) {
            for (const item of obj) {
                // Adidas usually has modelId, price, image config, displayName
                if (item && (item.displayName || item.name || item.modelId) && (item.price !== undefined || item.salePrice !== undefined)) {
                    const priceVal = item.salePrice || item.price;
                    if (priceVal && !isNaN(parseFloat(priceVal))) {
                        items.push({
                            raw_title: item.displayName || item.name || item.modelId || '',
                            raw_price: parseFloat(priceVal),
                            raw_url: item.link || item.url || '',
                            raw_image_url: item.image?.src || item.imageUrl || ''
                        });
                    }
                } else {
                    items = items.concat(this.findAdidasProducts(item, depth + 1));
                }
            }
        } else {
            if (obj.itemList?.items || obj.products || obj.hits || obj.productSearch?.items) {
                const searchSpace = obj.itemList?.items || obj.products || obj.hits || obj.productSearch?.items;
                items = items.concat(this.findAdidasProducts(searchSpace, depth + 1));
            } else {
                for (const key of Object.keys(obj)) {
                    if (key !== 'translations' && key !== 'meta') {
                        items = items.concat(this.findAdidasProducts(obj[key], depth + 1));
                    }
                }
            }
        }
        return items;
    }
}

module.exports = AdidasIsraelAgent;
