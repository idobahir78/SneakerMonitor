const DOMNavigator = require('./DOMNavigator');

class HokaIsraelAgent extends DOMNavigator {
    constructor() {
        super('Hoka Israel', 'https://newrun.co.il');
    }

    async scrape(brand, model) {
        if (brand.toLowerCase() !== 'hoka') return [];
        const query = encodeURIComponent(model);
        const searchUrl = `${this.targetUrl}/search?q=${query}`;

        return new Promise(async (resolve) => {
            try {
                await this.navigateWithRetry(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await new Promise(r => setTimeout(r, 2000));

                const products = await this.page.evaluate(() => {
                    const results = [];
                    const tiles = document.querySelectorAll('.product-card, .grid-item');

                    tiles.forEach(tile => {
                        const titleEl = tile.querySelector('.product-card__title, .grid-view-item__title');
                        const priceEl = tile.querySelector('.price-item--regular, .product-card__price');
                        const linkEl = tile.querySelector('a');
                        const imgEl = tile.querySelector('img');

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

                console.log(`[Hoka Israel] Found ${products.length} products`);
                resolve(products);
            } catch (err) {
                console.error(`[Hoka Israel] Scrape error: ${err.message}`);
                resolve([]);
            }
        });
    }
}

module.exports = HokaIsraelAgent;
