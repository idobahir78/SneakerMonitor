const DOMNavigator = require('./DOMNavigator');

class NikeIsraelAgent extends DOMNavigator {
    constructor() {
        super('Nike Israel', 'https://www.nike.com/il');
    }

    async scrape(brand, model) {
        if (brand.toLowerCase() !== 'nike' && brand.toLowerCase() !== 'jordan') return [];
        const query = encodeURIComponent(`${brand} ${model}`);
        const searchUrl = `${this.targetUrl}/w?q=${query}`;

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
                            (url.includes('graphql') || url.includes('api') || url.includes('search'))) {
                            const data = await response.json();
                            const products = this.findNikeProducts(data);

                            if (products && products.length > 0) {
                                interceptedItems = interceptedItems.concat(products);
                                apiDataCaptured = true;
                                console.log(`[Nike Israel] Successfully intercepted API response with ${products.length} items`);
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
                try { await this.page.waitForSelector('.product-card, .product-grid__item', { timeout: 10000 }); } catch (e) { }
                await new Promise(r => setTimeout(r, 1000));

                const domProducts = await this.page.evaluate(() => {
                    const results = [];
                    const tiles = document.querySelectorAll('.product-card, .product-grid__item');

                    tiles.forEach(tile => {
                        const titleEl = tile.querySelector('.product-card__title, .product-card__link-overlay');
                        const subtitleEl = tile.querySelector('.product-card__subtitle');
                        const priceEl = tile.querySelector('.product-price');
                        const linkEl = tile.querySelector('a.product-card__link-overlay') || tile.querySelector('a');
                        const imgEl = tile.querySelector('img.product-card__hero-image');

                        if (titleEl && priceEl) {
                            const rawTitle = titleEl.innerText.trim();
                            const rawSubtitle = subtitleEl ? subtitleEl.innerText.trim() : '';
                            const priceText = priceEl.getAttribute('data-product-price') || priceEl.innerText || '0';

                            // Prevent "5 ILS" bug by extracting exact digits
                            const priceMatch = priceText.match(/(\d{2,4}\.?\d{0,2})/);
                            const rawPrice = priceMatch ? parseFloat(priceMatch[1]) : 0;

                            results.push({
                                raw_title: `${rawTitle} ${rawSubtitle}`.trim(),
                                raw_price: rawPrice,
                                raw_url: linkEl?.href || '',
                                raw_image_url: imgEl?.src || imgEl?.getAttribute('data-src') || ''
                            });
                        }
                    });
                    return results;
                });

                if (domProducts.length === 0 && interceptedItems.length === 0) {
                    console.error(`[Nike Israel] DEBUG: Blocked by security or DEBUG: Empty response. 0 products found.`);
                } else {
                    console.log(`[Nike Israel] Found ${domProducts.length} products via DOM fallback`);
                }

                resolve(interceptedItems.length > 0 ? interceptedItems : domProducts);
            } catch (err) {
                console.error(`[Nike Israel] Scrape error: ${err.message}`);
                resolve([]);
            }
        });
    }

    findNikeProducts(obj, depth = 0) {
        if (depth > 6 || !obj || typeof obj !== 'object') return [];
        let items = [];

        // Characteristic Nike API structure checks
        if (Array.isArray(obj)) {
            for (const item of obj) {
                if (item && (item.title || item.subtitle || item.price || item.currentPrice)) {
                    const priceVal = item.price?.currentPrice || item.currentPrice || item.price;
                    if (priceVal && !isNaN(parseFloat(priceVal))) {
                        items.push({
                            raw_title: (item.title || '') + ' ' + (item.subtitle || ''),
                            raw_price: parseFloat(priceVal),
                            raw_url: item.url || item.pdpUrl || '',
                            raw_image_url: item.image?.url || item.imageUrl || item.squarishURL || ''
                        });
                    }
                } else {
                    items = items.concat(this.findNikeProducts(item, depth + 1));
                }
            }
        } else {
            if (obj.objects || obj.products || obj.items) {
                const searchSpace = obj.objects || obj.products || obj.items;
                items = items.concat(this.findNikeProducts(searchSpace, depth + 1));
            } else {
                for (const key of Object.keys(obj)) {
                    if (key !== 'settings' && key !== 'config') {
                        items = items.concat(this.findNikeProducts(obj[key], depth + 1));
                    }
                }
            }
        }
        return items;
    }
}

module.exports = NikeIsraelAgent;
