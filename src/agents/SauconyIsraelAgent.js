const DOMNavigator = require('./DOMNavigator');

class SauconyIsraelAgent extends DOMNavigator {
    constructor() {
        // Updated to saucony.com global (was pointing at saucony.co.il which uses a broken Magento path)
        super('Saucony Israel', 'https://www.saucony.com');
    }

    async scrape(brand, model) {
        if (brand.toLowerCase() !== 'saucony') return [];
        const query = encodeURIComponent(model);
        // Saucony.com Demandware search URL – browser research confirmed this works
        const searchUrl = `https://www.saucony.com/en/search?q=${query}`;

        return new Promise(async (resolve) => {
            try {
                console.log(`[Saucony Israel] Navigating to: ${searchUrl}`);
                await this.navigateWithRetry(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await new Promise(r => setTimeout(r, 4000));

                // Close any popup/newsletter modal before scraping
                try {
                    await this.page.click('#email-signup-modal .close, .modal-close, [id*="close"]', { timeout: 2000 });
                } catch (e) { }

                try {
                    await this.page.waitForSelector('.product-tile, .enhanced-search-product-tile', { timeout: 10000 });
                } catch (e) { }

                const products = await this.page.evaluate(() => {
                    const results = [];
                    // Saucony uses Demandware SFCC – tile class confirmed by browser research
                    const tiles = document.querySelectorAll('.product-tile, .enhanced-search-product-tile');

                    tiles.forEach(tile => {
                        const titleEl = tile.querySelector('.name-link, .product-name a, .product-link');
                        const priceEl = tile.querySelector('.price-sales, .product-pricing, .regular-price, .price');
                        const linkEl = tile.querySelector('a.product-image, a.name-link') || tile.querySelector('a');
                        const imgEl = tile.querySelector('img.product-image, img');

                        const title = titleEl?.innerText?.trim() || titleEl?.getAttribute('title') || '';
                        if (!title) return;

                        const priceText = priceEl?.innerText || '0';
                        const priceMatch = priceText.match(/(\d{2,5}\.?\d{0,2})/);
                        const price = priceMatch ? parseFloat(priceMatch[1]) : 0;

                        results.push({
                            raw_title: title,
                            raw_price: price,
                            raw_url: linkEl?.href || '',
                            raw_image_url: imgEl?.src || imgEl?.getAttribute('data-src') || ''
                        });
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
