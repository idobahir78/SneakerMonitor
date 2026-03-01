const DOMNavigator = require('./DOMNavigator');

class NikeIsraelAgent extends DOMNavigator {
    constructor() {
        super('Nike Israel', 'https://www.nike.com/il');
    }

    async scrape(brand, model) {
        // Nike Israel only sells Nike/Jordan products
        if (brand.toLowerCase() !== 'nike' && brand.toLowerCase() !== 'jordan') return [];

        // Use `vst` (visual search term) which significantly improves Nike.com result accuracy
        const q = encodeURIComponent(model);
        const searchUrl = `${this.targetUrl}/w?q=${q}&vst=${q}`;

        let interceptedItems = [];
        let apiDataCaptured = false;

        return new Promise(async (resolve) => {
            try {
                // Intercept Nike's search API (Wall API) responses
                this.page.on('response', async (response) => {
                    if (apiDataCaptured) return;
                    try {
                        const url = response.url();
                        if (
                            response.headers()['content-type']?.includes('application/json') &&
                            (url.includes('api.nike.com') || url.includes('wall') || url.includes('search'))
                        ) {
                            const data = await response.json();
                            const products = this._parseNikeResponse(data);
                            if (products.length > 0) {
                                interceptedItems = products;
                                apiDataCaptured = true;
                                console.log(`[Nike Israel] API intercepted: ${products.length} items`);
                            }
                        }
                    } catch (e) { }
                });

                console.log(`[Nike Israel] Navigating to: ${searchUrl}`);
                await this.navigateWithRetry(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await new Promise(r => setTimeout(r, 5000)); // Wait for React hydration + API

                if (apiDataCaptured && interceptedItems.length > 0) {
                    return resolve(interceptedItems);
                }

                // DOM fallback – Nike.com uses data-testid attributes
                try { await this.page.waitForSelector('[data-testid="product-card"]', { timeout: 10000 }); } catch (e) { }

                const domProducts = await this.page.evaluate(() => {
                    const results = [];
                    const tiles = document.querySelectorAll('[data-testid="product-card"]');

                    tiles.forEach(tile => {
                        const titleEl = tile.querySelector('.product-card__title, [data-test="product-name"]');
                        const subtitleEl = tile.querySelector('.product-card__subtitle');
                        const priceEl = tile.querySelector('[data-test="product-price"], .product-price');
                        const linkEl = tile.querySelector('.product-card__link-overlay, a[href*="/t/"]');
                        const imgEl = tile.querySelector('img.product-card__hero-image, img');

                        if (titleEl) {
                            const title = `${titleEl.innerText.trim()} ${subtitleEl?.innerText?.trim() || ''}`.trim();
                            const priceText = priceEl?.innerText || priceEl?.getAttribute('data-product-price') || '0';
                            const priceMatch = priceText.match(/(\d{2,5}\.?\d{0,2})/);
                            const price = priceMatch ? parseFloat(priceMatch[1]) : 0;

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

                console.log(`[Nike Israel] Found ${domProducts.length} products via DOM`);
                resolve(interceptedItems.length > 0 ? interceptedItems : domProducts);
            } catch (err) {
                console.error(`[Nike Israel] Scrape error: ${err.message}`);
                resolve([]);
            }
        });
    }

    _parseNikeResponse(obj, depth = 0) {
        if (depth > 7 || !obj || typeof obj !== 'object') return [];
        let items = [];

        if (Array.isArray(obj)) {
            for (const item of obj) {
                if (item && (item.title || item.subtitle) && (item.price || item.currentPrice !== undefined)) {
                    const price = parseFloat(item.price?.currentPrice || item.currentPrice || item.price || 0);
                    if (price > 0) {
                        items.push({
                            raw_title: `${item.title || ''} ${item.subtitle || ''}`.trim(),
                            raw_price: price,
                            raw_url: item.url || item.pdpUrl || '',
                            raw_image_url: item.image?.url || item.squarishURL || item.imageUrl || ''
                        });
                    }
                } else {
                    items = items.concat(this._parseNikeResponse(item, depth + 1));
                }
            }
        } else {
            const searchKeys = ['objects', 'products', 'items', 'nodes', 'edges', 'data'];
            const found = searchKeys.find(k => obj[k]);
            if (found) {
                items = items.concat(this._parseNikeResponse(obj[found], depth + 1));
            } else {
                for (const key of Object.keys(obj)) {
                    if (!['settings', 'config', 'meta', 'analytics'].includes(key)) {
                        items = items.concat(this._parseNikeResponse(obj[key], depth + 1));
                    }
                }
            }
        }
        return items;
    }
}

module.exports = NikeIsraelAgent;
