const DOMNavigator = require('./DOMNavigator');

class NikeIsraelAgent extends DOMNavigator {
    constructor() {
        super('Nike Israel', 'https://www.nike.com/il');
    }

    async scrape(brand, model) {
        if (brand.toLowerCase() !== 'nike' && brand.toLowerCase() !== 'jordan') return [];
        const query = encodeURIComponent(`${brand} ${model}`);
        const searchUrl = `${this.targetUrl}/w?q=${query}`;

        return new Promise(async (resolve) => {
            try {
                await this.navigateWithRetry(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                try { await this.page.waitForSelector('.product-card, .product-grid__item', { timeout: 15000 }); } catch (e) { console.log('[Nike Israel] Timeout waiting for items'); }
                await new Promise(r => setTimeout(r, 1000));

                const products = await this.page.evaluate(() => {
                    const results = [];
                    const tiles = document.querySelectorAll('.product-card, .product-grid__item');

                    tiles.forEach(tile => {
                        const titleEl = tile.querySelector('.product-card__title, .product-card__link-overlay');
                        const priceEl = tile.querySelector('.product-price');
                        const linkEl = tile.querySelector('a.product-card__link-overlay') || tile.querySelector('a');
                        const imgEl = tile.querySelector('img.product-card__hero-image');

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

                console.log(`[Nike Israel] Found ${products.length} products`);
                resolve(products);
            } catch (err) {
                console.error(`[Nike Israel] Scrape error: ${err.message}`);
                resolve([]);
            }
        });
    }
}

module.exports = NikeIsraelAgent;
