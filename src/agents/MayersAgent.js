const DOMNavigator = require('./DOMNavigator');

class MayersAgent extends DOMNavigator {
    constructor() {
        super('Mayers', 'https://www.mayers.co.il');
    }

    async scrape(brand, model) {
        const query = encodeURIComponent(`${brand} ${model}`);
        const searchUrl = `${this.targetUrl}/search?q=${query}&type=product`;

        return new Promise(async (resolve) => {
            try {
                console.log(`[Mayers] Navigating to: ${searchUrl}`);
                await this.navigateWithRetry(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

                try {
                    await this.page.waitForSelector('.product-card, .grid__item, .product-item, .collection-product-card', { timeout: 30000 });
                } catch (e) {
                    console.log('[Mayers] DEBUG: No product containers found after 30s wait.');
                }

                const debugInfo = await this.page.evaluate(() => {
                    return {
                        title: document.title,
                        url: window.location.href,
                        bodyText: document.body?.innerText?.substring(0, 500) || '',
                        allProductClasses: [...document.querySelectorAll('[class*="product"]')].map(el => el.className).slice(0, 10)
                    };
                });
                console.log(`[Mayers] DEBUG: Page title="${debugInfo.title}", URL="${debugInfo.url}"`);
                console.log(`[Mayers] DEBUG: Product classes found: ${JSON.stringify(debugInfo.allProductClasses)}`);

                const products = await this.page.evaluate(() => {
                    const results = [];
                    const tiles = document.querySelectorAll('.product-card, .grid__item, .product-item, .collection-product-card, .grid-product');

                    tiles.forEach(tile => {
                        const titleEl = tile.querySelector('.product-card__title, .grid-view-item__title, h3, h2, .product-title, .product-name, a.product-card__link');
                        const priceEl = tile.querySelector('.price-item--regular, .product-card__price, .price, .money, span[class*="price"]');
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
                    console.error(`[Mayers] DEBUG: Blocked by security or DEBUG: Empty response. 0 products found.`);
                } else {
                    console.log(`[Mayers] Found ${products.length} products`);
                }
                resolve(products);
            } catch (err) {
                console.error(`[Mayers] Scrape error: ${err.message}`);
                resolve([]);
            }
        });
    }
}

module.exports = MayersAgent;
