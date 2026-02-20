const DOMNavigator = require('./DOMNavigator');

class PumaIsraelAgent extends DOMNavigator {
    constructor() {
        super('Puma Israel', 'https://www.puma.co.il');
    }

    async scrape(brand, model) {
        if (brand.toLowerCase() !== 'puma') return [];
        const query = encodeURIComponent(model);
        const searchUrl = `${this.targetUrl}/catalogsearch/result/?q=${query}`;

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
                            (url.includes('api') || url.includes('graphql') || url.includes('search'))) {
                            const data = await response.json();
                            const products = this.findPumaProducts(data);

                            if (products && products.length > 0) {
                                interceptedItems = interceptedItems.concat(products);
                                apiDataCaptured = true;
                                console.log(`[Puma Israel] Successfully intercepted API response with ${products.length} items`);
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

                try { await this.page.waitForSelector('.product-item, .product-item-info', { timeout: 10000 }); } catch (e) { console.log('[Puma Israel] DOM timeout waiting for items.'); }
                await new Promise(r => setTimeout(r, 1000));

                const products = await this.page.evaluate(() => {
                    const results = [];
                    const tiles = document.querySelectorAll('.product-item, .product-item-info');

                    tiles.forEach(tile => {
                        const titleEl = tile.querySelector('.product-item-link, .name');
                        const priceEl = tile.querySelector('.price');
                        const linkEl = tile.querySelector('a.product-item-photo') || tile.querySelector('a');
                        const imgEl = tile.querySelector('img.product-image-photo, img');

                        if (titleEl && priceEl) {
                            const title = titleEl.innerText.trim();
                            const priceText = priceEl.innerText.replace(/[^\d.]/g, '');
                            const price = parseFloat(priceText) || 0;

                            results.push({
                                raw_title: title,
                                raw_price: price,
                                raw_url: linkEl?.href || '',
                                raw_image_url: imgEl?.src || imgEl?.getAttribute('data-src') || ''
                            });
                        }
                    });
                    return results;
                });

                if (products.length === 0 && interceptedItems.length === 0) {
                    console.error(`[Puma Israel] DEBUG: Blocked by security or DEBUG: Empty response. 0 products found.`);
                } else if (products.length > 0) {
                    console.log(`[Puma Israel] Found ${products.length} products via DOM fallback`);
                }

                resolve(interceptedItems.length > 0 ? interceptedItems : products);
            } catch (err) {
                console.error(`[Puma Israel] Scrape error: ${err.message}`);
                resolve([]);
            }
        });
    }

    findPumaProducts(obj, depth = 0) {
        if (depth > 6 || !obj || typeof obj !== 'object') return [];
        let items = [];

        if (Array.isArray(obj)) {
            for (const item of obj) {
                if (item && (item.name || item.title) && (item.price || item.final_price)) {
                    const priceVal = item.final_price !== undefined ? item.final_price : item.price;
                    if (priceVal && !isNaN(parseFloat(priceVal))) {
                        items.push({
                            raw_title: item.name || item.title || '',
                            raw_price: parseFloat(priceVal),
                            raw_url: item.url || item.product_url || '',
                            raw_image_url: item.image || item.image_url || item.thumbnail || ''
                        });
                    }
                } else {
                    items = items.concat(this.findPumaProducts(item, depth + 1));
                }
            }
        } else {
            if (obj.items || obj.products) {
                const searchSpace = obj.items || obj.products;
                items = items.concat(this.findPumaProducts(searchSpace, depth + 1));
            } else {
                for (const key of Object.keys(obj)) {
                    if (key !== 'aggregations' && key !== 'sort_fields') {
                        items = items.concat(this.findPumaProducts(obj[key], depth + 1));
                    }
                }
            }
        }
        return items;
    }
}

module.exports = PumaIsraelAgent;
