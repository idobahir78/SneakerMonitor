const DOMNavigator = require('./DOMNavigator');

class SauconyIsraelAgent extends DOMNavigator {
    constructor() {
        super('Saucony Israel', 'https://saucony.co.il');
    }

    async scrape(brand, model) {
        if (brand.toLowerCase() !== 'saucony') return [];
        const query = encodeURIComponent(model);
        const searchUrl = `${this.targetUrl}/catalogsearch/result/?q=${query}`;

        return new Promise(async (resolve) => {
            try {
                await this.navigateWithRetry(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await new Promise(r => setTimeout(r, 2000));

                const products = await this.page.evaluate(() => {
                    const results = [];
                    const tiles = document.querySelectorAll('.product-item');

                    tiles.forEach(tile => {
                        const titleEl = tile.querySelector('.product-item-link, .product-name');
                        const priceEl = tile.querySelector('.price, .special-price .price');
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

                console.log(`[Saucony Israel] Found ${products.length} products`);
                resolve(products);
            } catch (err) {
                console.error(`[Saucony Israel] Scrape error: ${err.message}`);
                resolve([]);
            }
        });
    }
}

module.exports = SauconyIsraelAgent;
