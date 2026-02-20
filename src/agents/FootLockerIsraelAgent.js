const DOMNavigator = require('./DOMNavigator');

class FootLockerIsraelAgent extends DOMNavigator {
    constructor() {
        super('Foot Locker Israel', 'https://www.footlocker.co.il');
    }

    async scrape(brand, model) {
        const query = encodeURIComponent(`${brand} ${model}`);
        const searchUrl = `${this.targetUrl}/catalogsearch/result/?q=${query}`;

        return new Promise(async (resolve) => {
            try {
                await this.navigateWithRetry(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                try { await this.page.waitForSelector('.product-item, .item.product', { timeout: 60000 }); } catch (e) { console.log('[Foot Locker Israel] Timeout waiting for items. Bot detection suspected or empty page.'); }
                await new Promise(r => setTimeout(r, 1000));

                const products = await this.page.evaluate(() => {
                    const results = [];
                    const tiles = document.querySelectorAll('.product-item, .item.product');

                    tiles.forEach(tile => {
                        const titleEl = tile.querySelector('.product-item-link, .name');
                        const priceEl = tile.querySelector('.price');
                        const linkEl = tile.querySelector('a.product-item-photo') || tile.querySelector('a');
                        const imgEl = tile.querySelector('img.product-image-photo');

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
                    console.error(`[Foot Locker Israel] DEBUG: Blocked by security or DEBUG: Empty response. 0 products found.`);
                } else {
                    console.log(`[Foot Locker Israel] Found ${products.length} products`);
                }
                resolve(products);
            } catch (err) {
                console.error(`[Foot Locker Israel] Scrape error: ${err.message}`);
                resolve([]);
            }
        });
    }
}

module.exports = FootLockerIsraelAgent;
