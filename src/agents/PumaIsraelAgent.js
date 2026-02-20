const DOMNavigator = require('./DOMNavigator');

class PumaIsraelAgent extends DOMNavigator {
    constructor() {
        super('Puma Israel', 'https://www.puma.co.il');
    }

    async scrape(brand, model) {
        if (brand.toLowerCase() !== 'puma') return [];
        const query = encodeURIComponent(model);
        const searchUrl = `${this.targetUrl}/catalogsearch/result/?q=${query}`;

        return new Promise(async (resolve) => {
            try {
                await this.navigateWithRetry(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                try { await this.page.waitForSelector('.product-item, .product-item-info', { timeout: 60000 }); } catch (e) { console.log('[Puma Israel] Timeout waiting for items. Bot detection suspected or empty page.'); }
                await new Promise(r => setTimeout(r, 1000));

                const products = await this.page.evaluate(() => {
                    const results = [];
                    const tiles = document.querySelectorAll('.product-item, .product-item-info');

                    tiles.forEach(tile => {
                        const titleEl = tile.querySelector('.product-item-link, .name');
                        const priceEl = tile.querySelector('.price');
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

                if (products.length === 0) {
                    console.error(`[Puma Israel] 0 products found. Selector not found or bot detection suspected.`);
                } else {
                    console.log(`[Puma Israel] Found ${products.length} products`);
                }
                resolve(products);
            } catch (err) {
                console.error(`[Puma Israel] Scrape error: ${err.message}`);
                resolve([]);
            }
        });
    }
}

module.exports = PumaIsraelAgent;
