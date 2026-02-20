const DOMNavigator = require('./DOMNavigator');

class AdidasIsraelAgent extends DOMNavigator {
    constructor() {
        super('Adidas Israel', 'https://www.adidas.co.il/he');
    }

    async scrape(brand, model) {
        if (brand.toLowerCase() !== 'adidas' && brand.toLowerCase() !== 'yeezy') return [];
        const query = encodeURIComponent(`${brand} ${model}`);
        const searchUrl = `${this.targetUrl}/search?q=${query}`;

        return new Promise(async (resolve) => {
            try {
                await this.navigateWithRetry(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await new Promise(r => setTimeout(r, 2000));

                const products = await this.page.evaluate(() => {
                    const results = [];
                    const tiles = document.querySelectorAll('.product-card, .grid-item');

                    tiles.forEach(tile => {
                        const titleEl = tile.querySelector('.product-card-title, .product-name');
                        const priceEl = tile.querySelector('.product-price, .price-display');
                        const linkEl = tile.querySelector('a.product-card-link') || tile.querySelector('a');
                        const imgEl = tile.querySelector('img.product-card-image');

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

                console.log(`[Adidas Israel] Found ${products.length} products`);
                resolve(products);
            } catch (err) {
                console.error(`[Adidas Israel] Scrape error: ${err.message}`);
                resolve([]);
            }
        });
    }
}

module.exports = AdidasIsraelAgent;
