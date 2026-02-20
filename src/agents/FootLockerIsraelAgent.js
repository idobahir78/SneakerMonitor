const DOMNavigator = require('./DOMNavigator');

class FootLockerIsraelAgent extends DOMNavigator {
    constructor() {
        super('Foot Locker Israel', 'https://footlocker.co.il');
    }

    async scrape(brand, model) {
        const query = encodeURIComponent(`${brand} ${model}`);
        const searchUrl = `${this.targetUrl}/search?q=${query}`;

        return new Promise(async (resolve) => {
            try {
                console.log(`[Foot Locker Israel] Navigating to: ${searchUrl}`);
                await this.navigateWithRetry(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

                try {
                    await this.page.waitForSelector('.product-item, .product-card, [class*="ProductItem"], .grid-product', { timeout: 30000 });
                } catch (e) {
                    console.log('[Foot Locker Israel] Timeout waiting for product containers.');
                }

                const debugInfo = await this.page.evaluate(() => ({
                    title: document.title,
                    url: window.location.href,
                    productClasses: [...document.querySelectorAll('[class*="product"], [class*="Product"]')].map(el => el.className).slice(0, 10)
                }));
                console.log(`[Foot Locker Israel] DEBUG: title="${debugInfo.title}", url="${debugInfo.url}"`);
                console.log(`[Foot Locker Israel] DEBUG: Product classes: ${JSON.stringify(debugInfo.productClasses)}`);

                const products = await this.page.evaluate(() => {
                    const results = [];
                    const tiles = document.querySelectorAll('.product-item, .product-card, [class*="ProductItem"], .grid-product, .product-list .card');

                    tiles.forEach(tile => {
                        const titleEl = tile.querySelector('.product-item-link, .product-card__title, h3, h2, .product-title, [class*="title"]');
                        const priceEl = tile.querySelector('.price, .money, [class*="price"], [class*="Price"]');
                        const linkEl = tile.querySelector('a[href*="/products/"]') || tile.querySelector('a');
                        const imgEl = tile.querySelector('img');

                        if (titleEl) {
                            const title = titleEl.innerText.trim();
                            let price = 0;
                            if (priceEl) {
                                const priceText = priceEl.innerText.replace(/[^\d.]/g, '');
                                price = parseFloat(priceText) || 0;
                            }

                            results.push({
                                raw_title: title,
                                raw_price: price,
                                raw_url: linkEl?.href || '',
                                raw_image_url: imgEl?.src || imgEl?.getAttribute('data-src') || imgEl?.getAttribute('data-srcset')?.split(' ')[0] || ''
                            });
                        }
                    });
                    return results;
                });

                if (products.length === 0) {
                    console.error(`[Foot Locker Israel] DEBUG: Blocked by security or empty response. 0 products.`);
                } else {
                    console.log(`[Foot Locker Israel] Found ${products.length} products`);
                }
                resolve(products);
            } catch (err) {
                console.error(`[Foot Locker Israel] Scrape error: ${err.message}`);
                resolve([]);
            }
        });
    }
}

module.exports = FootLockerIsraelAgent;
