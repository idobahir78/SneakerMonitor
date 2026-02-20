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
                    const tiles = document.querySelectorAll('.product-card, .grid-item');

                    tiles.forEach(tile => {
                        const titleEl = tile.querySelector('.product-card-title, .product-name');
                        const priceEl = tile.querySelector('.product-price, .price-display');
                        const linkEl = tile.querySelector('a.product-card-link') || tile.querySelector('a');
                        const imgEl = tile.querySelector('img.product-card-image');

                        if (titleEl && priceEl) {
                            results.push({
                                raw_title: titleEl.innerText.trim(),
                                raw_price: parseFloat(priceEl.innerText.replace(/[^\d.]/g, '')) || 0,
                                raw_url: linkEl?.href || '',
                                raw_image_url: imgEl?.src || imgEl?.getAttribute('data-src') || ''
                            });
                        }
                    });
                    return results;
                });

                if (domProducts.length === 0 && interceptedItems.length === 0) {
                    console.error(`[Adidas Israel] 0 products found. Selector not found or bot detection suspected.`);
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
