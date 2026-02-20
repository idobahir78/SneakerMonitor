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
                    await this.page.waitForSelector('.product-item, .product-card, .product-facet__result-item', { timeout: 30000 });
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
                    const tiles = document.querySelectorAll('.product-item, .product-card, .product-facet__result-item, .product-list .card');

                    tiles.forEach(tile => {
                        const linkEl = tile.querySelector('a[href*="/products/"]') || tile.querySelector('a');
                        const titleEl = tile.querySelector('.product-item__title, .product-card__title, h3, h2') || linkEl;
                        const priceEl = tile.querySelector('.price__current, .product-item__price, .price, .money');
                        const imgEl = tile.querySelector('.product-item__primary-image, img');

                        if (titleEl) {
                            const title = titleEl.innerText.trim();
                            let price = 0;
                            if (priceEl) {
                                const priceText = priceEl.innerText.replace(/[^\d.]/g, '');
                                price = parseFloat(priceText) || 0;
                            }

                            let rawUrl = linkEl?.href || '';
                            if (rawUrl.startsWith('/')) rawUrl = 'https://footlocker.co.il' + rawUrl;
                            let rawImg = imgEl?.src || imgEl?.getAttribute('data-src') || imgEl?.getAttribute('data-srcset')?.split(' ')[0] || '';
                            if (rawImg.startsWith('/')) rawImg = 'https://footlocker.co.il' + rawImg;

                            results.push({
                                raw_title: title,
                                raw_price: price,
                                raw_url: rawUrl,
                                raw_image_url: rawImg
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
