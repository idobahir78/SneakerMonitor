const DOMNavigator = require('./DOMNavigator');

class KicksAgent extends DOMNavigator {
    constructor() {
        super('KICKS', 'https://kicks.co.il');
    }

    async scrape(brand, model) {
        const query = encodeURIComponent(`${brand} ${model}`);
        // Adjust this if KICKS uses a different search path
        const searchUrl = `${this.targetUrl}/?s=${query}&post_type=product`;

        return new Promise(async (resolve) => {
            try {
                await this.navigateWithRetry(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await new Promise(r => setTimeout(r, 2000));

                const products = await this.page.evaluate(() => {
                    const results = [];
                    const tiles = document.querySelectorAll('.product, .type-product');

                    tiles.forEach(tile => {
                        const titleEl = tile.querySelector('.woocommerce-loop-product__title, h2');
                        const priceEl = tile.querySelector('.price');
                        const linkEl = tile.querySelector('a');
                        const imgEl = tile.querySelector('img');

                        if (titleEl && priceEl) {
                            const title = titleEl.innerText.trim();
                            const priceText = priceEl.innerText.replace(/[^\d.]/g, '');
                            // Kicks often has a range or sale price, take the first/lowest match conceptually
                            const priceMatch = priceText.match(/[\d.]+/);
                            const price = priceMatch ? parseFloat(priceMatch[0]) : 0;

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

                console.log(`[KICKS] Found ${products.length} products`);
                resolve(products);
            } catch (err) {
                console.error(`[KICKS] Scrape error: ${err.message}`);
                resolve([]);
            }
        });
    }
}

module.exports = KicksAgent;
