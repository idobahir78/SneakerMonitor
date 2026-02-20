const DOMNavigator = require('./DOMNavigator');

class KicksAgent extends DOMNavigator {
    constructor() {
        super('KICKS', 'https://kicks.co.il');
    }

    async scrape(brand, model) {
        const query = encodeURIComponent(`${brand} ${model}`);
        const searchUrl = `${this.targetUrl}/?s=${query}&post_type=product`;

        return new Promise(async (resolve) => {
            try {
                console.log(`[KICKS] Navigating to: ${searchUrl}`);
                await this.navigateWithRetry(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

                try {
                    await this.page.waitForSelector('.product, .type-product, .products .product, li.product', { timeout: 30000 });
                } catch (e) {
                    console.log('[KICKS] DEBUG: No product containers found after 30s wait.');
                }

                const debugInfo = await this.page.evaluate(() => {
                    return {
                        title: document.title,
                        url: window.location.href,
                        bodyText: document.body?.innerText?.substring(0, 500) || '',
                        allProductClasses: [...document.querySelectorAll('[class*="product"]')].map(el => el.className).slice(0, 10)
                    };
                });
                console.log(`[KICKS] DEBUG: Page title="${debugInfo.title}", URL="${debugInfo.url}"`);
                console.log(`[KICKS] DEBUG: Product classes found: ${JSON.stringify(debugInfo.allProductClasses)}`);

                const products = await this.page.evaluate(() => {
                    const results = [];
                    const tiles = document.querySelectorAll('.product, .type-product, li.product, .products .product-item, .product-grid-item');

                    tiles.forEach(tile => {
                        const titleEl = tile.querySelector('.woocommerce-loop-product__title, h2, h3, .product-title, .product-name');
                        const priceEl = tile.querySelector('.price, .amount, bdi');
                        const linkEl = tile.querySelector('a[href*="/product/"]') || tile.querySelector('a');
                        const imgEl = tile.querySelector('img');

                        if (titleEl) {
                            const title = titleEl.innerText.trim();
                            let price = 0;
                            if (priceEl) {
                                const priceText = priceEl.innerText.replace(/[^\d.]/g, '');
                                const priceMatch = priceText.match(/[\d.]+/);
                                price = priceMatch ? parseFloat(priceMatch[0]) : 0;
                            }

                            results.push({
                                raw_title: title,
                                raw_price: price,
                                raw_url: linkEl?.href || '',
                                raw_image_url: imgEl?.src || imgEl?.getAttribute('data-src') || imgEl?.getAttribute('data-lazy-src') || ''
                            });
                        }
                    });
                    return results;
                });

                if (products.length === 0) {
                    console.error(`[KICKS] DEBUG: Blocked by security or DEBUG: Empty response. 0 products found.`);
                } else {
                    console.log(`[KICKS] Found ${products.length} products`);
                }
                resolve(products);
            } catch (err) {
                console.error(`[KICKS] Scrape error: ${err.message}`);
                resolve([]);
            }
        });
    }
}

module.exports = KicksAgent;
