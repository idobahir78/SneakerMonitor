const DOMNavigator = require('./DOMNavigator');

// asics.com/il has persistent redirect loops. Replaced with originals.co.il
// (official Israeli Asics distributor, WooCommerce-based, browser-confirmed working)
class AsicsIsraelAgent extends DOMNavigator {
    constructor() {
        super('Asics Israel', 'https://www.originals.co.il');
    }

    async scrape(brand, model) {
        if (brand.toLowerCase() !== 'asics') return [];
        const query = encodeURIComponent(model);
        // originals.co.il uses standard WooCommerce search
        const searchUrl = `${this.targetUrl}/search?q=${query}`;

        return new Promise(async (resolve) => {
            try {
                console.log(`[Asics Israel] Navigating to: ${searchUrl}`);
                await this.navigateWithRetry(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await new Promise(r => setTimeout(r, 2000));

                // Dismiss promotional popup if present
                try {
                    await this.page.click('.popup-close, .modal-close, .newsletter-popup__close', { timeout: 2000 });
                } catch (e) { }

                try {
                    await this.page.waitForSelector('.thumbnail, .product-grid-item', { timeout: 10000 });
                } catch (e) { }

                const products = await this.page.evaluate(() => {
                    const results = [];
                    // Originals.co.il confirmed selectors from browser research
                    const tiles = document.querySelectorAll('.thumbnail, .product-grid-item, .product-item-info');

                    tiles.forEach(tile => {
                        const titleEl = tile.querySelector('.product-info__caption, .product-item-link, .product-name a');
                        const priceEl = tile.querySelector('.money, .price, .product-price');
                        const linkEl = tile.querySelector('.product_image a, a.thumbnail__media') || tile.querySelector('a');
                        const imgEl = tile.querySelector('img.thumbnail__image, img');

                        const title = titleEl?.innerText?.trim() || '';
                        if (!title) return;

                        const priceText = priceEl?.innerText || '0';
                        const priceMatch = priceText.match(/(\d{2,5}\.?\d{0,2})/);
                        const price = priceMatch ? parseFloat(priceMatch[1]) : 0;

                        // Sizes from swatches – soldout class means unavailable
                        const raw_sizes = [...tile.querySelectorAll('.swatch-element:not(.soldout) .swatch-label, .size-swatch:not(.unavailable)')]
                            .map(el => el.innerText.trim())
                            .filter(Boolean);

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

                console.log(`[Asics Israel] Found ${products.length} products`);
                resolve(products);
            } catch (err) {
                console.error(`[Asics Israel] Scrape error: ${err.message}`);
                resolve([]);
            }
        });
    }
}

module.exports = AsicsIsraelAgent;
