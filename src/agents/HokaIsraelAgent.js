const DOMNavigator = require('./DOMNavigator');

class HokaIsraelAgent extends DOMNavigator {
    constructor() {
        // Updated to hoka.com official Israel store (was pointing at newrun.co.il)
        super('Hoka Israel', 'https://www.hoka.com');
    }

    async scrape(brand, model) {
        if (brand.toLowerCase() !== 'hoka') return [];
        const query = encodeURIComponent(model);
        // hoka.com Israeli regional search URL
        const searchUrl = `https://www.hoka.com/en/il/search/?q=${query}`;

        return new Promise(async (resolve) => {
            try {
                console.log(`[Hoka Israel] Navigating to: ${searchUrl}`);
                await this.navigateWithRetry(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await new Promise(r => setTimeout(r, 4000));

                try {
                    await this.page.waitForSelector('.tile-row .product, .product-tile, .product-listing', { timeout: 10000 });
                } catch (e) { }

                const products = await this.page.evaluate(() => {
                    const results = [];
                    // Confirmed selectors from browser research
                    const tiles = document.querySelectorAll('.tile-row .product, .product-tile, .product');

                    tiles.forEach(tile => {
                        const titleEl = tile.querySelector('.product-name, .pdp-link a, .tile__name');
                        const priceEl = tile.querySelector('.sales .value, .price-sales .value, .price');
                        const linkEl = tile.querySelector('a.js-pdp-link, a.tile-image-link') || tile.querySelector('a');
                        const imgEl = tile.querySelector('img.tile-image, img');

                        const title = titleEl?.innerText?.trim() || '';
                        if (!title) return;

                        const priceText = priceEl?.innerText || '0';
                        const priceMatch = priceText.match(/(\d{3,5}\.?\d{0,2})/);
                        const price = priceMatch ? parseFloat(priceMatch[1]) : 0;

                        // Available sizes – out-of-stock have .out-of-stock or .disabled class
                        const raw_sizes = [...tile.querySelectorAll('button.options-select:not(.out-of-stock):not(.disabled)')]
                            .map(btn => btn.innerText.trim())
                            .filter(s => s && !isNaN(parseFloat(s)));

                        results.push({
                            raw_title: title,
                            raw_price: price,
                            raw_url: linkEl?.href || '',
                            raw_image_url: imgEl?.src || imgEl?.getAttribute('data-src') || '',
                            raw_sizes
                        });
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
