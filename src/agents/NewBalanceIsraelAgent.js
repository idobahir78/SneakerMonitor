const DOMNavigator = require('./DOMNavigator');

class NewBalanceIsraelAgent extends DOMNavigator {
    constructor() {
        super('New Balance IL', 'https://www.newbalance.co.il');
    }

    async scrape(brand, model) {
        if (brand.toLowerCase() !== 'new balance') return [];
        const query = encodeURIComponent(model);
        // Updated URL for Demandware migration
        const searchUrl = `${this.targetUrl}/he/category?q=${query}`;

        return new Promise(async (resolve) => {
            try {
                // Demandware pages often need a moment to hydrate the product grid
                await this.navigateWithRetry(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await new Promise(r => setTimeout(r, 4000));

                const products = await this.page.evaluate(() => {
                    const results = [];
                    const tiles = document.querySelectorAll('.product, .product-item, .product-tile');

                    tiles.forEach(tile => {
                        // Attempt exact JSON extraction from GTM data
                        const gtmDataStr = tile.getAttribute('data-gtmdata') || '{}';
                        let gtmObj = {};
                        try { gtmObj = JSON.parse(gtmDataStr); } catch (e) { }

                        const titleEl = tile.querySelector('.product-item-link, .product-name, .link, .pdp-link a');
                        const priceEl = tile.querySelector('.price, .special-price .price, .sales .value');
                        const linkEl = tile.querySelector('a.product-item-photo, a.tile-image-link') || tile.querySelector('a');
                        const imgEl = tile.querySelector('img.product-image-photo, img.tile-image, img');

                        const title = gtmObj.name || (titleEl ? titleEl.innerText.trim() : '');

                        let price = parseFloat(gtmObj.price) || 0;
                        if (!price && priceEl) {
                            const priceText = priceEl.getAttribute('content') || priceEl.innerText || '0';
                            const match = priceText.match(/(\d{2,4}\.?\d{0,2})/);
                            price = match ? parseFloat(match[1]) : 0;
                        }

                        if (title && price > 0) {
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

                console.log(`[New Balance IL] Found ${products.length} products`);
                resolve(products);
            } catch (err) {
                console.error(`[New Balance IL] Scrape error: ${err.message}`);
                resolve([]);
            }
        });
    }
}

module.exports = NewBalanceIsraelAgent;
