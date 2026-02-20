const DOMNavigator = require('./DOMNavigator');

class PumaIsraelAgent extends DOMNavigator {
    constructor() {
        super('Puma Israel', 'https://il.puma.com');
    }

    async scrape(brand, model) {
        if (brand.toLowerCase() !== 'puma') return [];
        const query = encodeURIComponent(`${brand} ${model}`);
        const searchUrl = `${this.targetUrl}/il/he/search?q=${query}`;
        const domain = this.targetUrl;

        let interceptedItems = [];
        let apiDataCaptured = false;

        return new Promise(async (resolve) => {
            try {
                this.page.on('response', async (response) => {
                    if (apiDataCaptured) return;
                    try {
                        const url = response.url().toLowerCase();
                        if (response.headers()['content-type']?.includes('application/json') &&
                            (url.includes('api') || url.includes('graphql') || url.includes('search') || url.includes('product'))) {
                            const data = await response.json();
                            const products = this.findPumaProducts(data);

                            if (products && products.length > 0) {
                                interceptedItems = interceptedItems.concat(products);
                                apiDataCaptured = true;
                                console.log(`[Puma Israel] Intercepted API with ${products.length} items`);
                            }
                        }
                    } catch (e) { }
                });

                console.log(`[Puma Israel] Navigating to: ${searchUrl}`);
                await this.navigateWithRetry(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

                await new Promise(r => setTimeout(r, 8000));

                if (apiDataCaptured && interceptedItems.length > 0) {
                    return resolve(interceptedItems);
                }

                try { await this.page.waitForSelector('.product-tile, [class*="product-tile"]', { timeout: 15000 }); } catch (e) { }

                const debugInfo = await this.page.evaluate(() => ({
                    title: document.title,
                    url: window.location.href,
                    productClasses: [...document.querySelectorAll('[class*="product"]')].map(el => el.className).slice(0, 10)
                }));
                console.log(`[Puma Israel] DEBUG: title="${debugInfo.title}", url="${debugInfo.url}"`);
                console.log(`[Puma Israel] DEBUG: Product classes: ${JSON.stringify(debugInfo.productClasses)}`);

                const products = await this.page.evaluate((baseDomain) => {
                    function norm(u) {
                        if (!u) return '';
                        u = u.trim();
                        if (u.startsWith('http')) return u;
                        if (u.startsWith('//')) return 'https:' + u;
                        if (u.startsWith('/')) return baseDomain + u;
                        return baseDomain + '/' + u;
                    }

                    const results = [];
                    const tiles = document.querySelectorAll('.product-tile');

                    tiles.forEach(tile => {
                        const linkEl = tile.querySelector('a.product-tile__link') || tile.querySelector('a[href*="/pd/"]') || tile.querySelector('a');
                        const titleEl = tile.querySelector('.product-tile__title, .product-tile-title') || linkEl;
                        const priceEl = tile.querySelector('.product-tile__price .value, .product-tile__price-current, [class*="price"] .value');
                        const imgEl = tile.querySelector('img.tile-image, img');

                        if (titleEl) {
                            results.push({
                                raw_title: titleEl.innerText.trim(),
                                raw_price: priceEl ? parseFloat(priceEl.innerText.replace(/[^\d.]/g, '')) || 0 : 0,
                                raw_url: norm(linkEl?.getAttribute('href') || ''),
                                raw_image_url: norm(imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || '')
                            });
                        }
                    });
                    return results;
                }, domain);

                if (products.length === 0 && interceptedItems.length === 0) {
                    console.error(`[Puma Israel] DEBUG: Blocked by security or empty response. 0 products.`);
                } else {
                    console.log(`[Puma Israel] Found ${products.length} products via DOM`);
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
                if (item && (item.name || item.title) && (item.price || item.salePrice || item.listPrice)) {
                    const priceVal = item.salePrice || item.price || item.listPrice;
                    if (priceVal && !isNaN(parseFloat(priceVal))) {
                        items.push({
                            raw_title: item.name || item.title || '',
                            raw_price: parseFloat(priceVal),
                            raw_url: item.url || item.pdpUrl || '',
                            raw_image_url: item.image?.url || item.imageUrl || item.thumbnail || ''
                        });
                    }
                } else {
                    items = items.concat(this.findPumaProducts(item, depth + 1));
                }
            }
        } else {
            if (obj.items || obj.products || obj.hits || obj.results) {
                const space = obj.items || obj.products || obj.hits || obj.results;
                items = items.concat(this.findPumaProducts(space, depth + 1));
            } else {
                for (const key of Object.keys(obj)) {
                    if (key !== 'aggregations' && key !== 'facets') {
                        items = items.concat(this.findPumaProducts(obj[key], depth + 1));
                    }
                }
            }
        }
        return items;
    }
}

module.exports = PumaIsraelAgent;
