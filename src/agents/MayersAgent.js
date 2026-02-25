const DOMNavigator = require('./DOMNavigator');

class MayersAgent extends DOMNavigator {
    constructor() {
        super('Mayers', 'https://www.mayers.co.il');
    }

    async scrape(brand, model) {
        const query = encodeURIComponent(`${brand} ${model}`);
        const searchUrl = `${this.targetUrl}/?s=${query}&post_type=product`;

        return new Promise(async (resolve) => {
            try {
                console.log(`[Mayers] Navigating to: ${searchUrl}`);
                await this.navigateWithRetry(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

                try {
                    await this.page.waitForSelector('.product-grid-item, .type-product, .product-wrapper, .product-card, .grid__item', { timeout: 30000 });
                } catch (e) {
                    console.log('[Mayers] DEBUG: No product containers found after 30s wait.');
                }

                const products = await this.page.evaluate(() => {
                    const results = [];
                    const tiles = document.querySelectorAll('.product-grid-item, .type-product, .product-card, .grid__item, .product-item, .collection-product-card');

                    tiles.forEach(tile => {
                        const titleEl = tile.querySelector('.product-image-link, .product-card__title, .grid-view-item__title, h3.product-title, h2, .product-name');
                        const priceEl = tile.querySelector('.price, .amount, .price-item--regular, .product-card__price, .money, span[class*="price"]');
                        const linkEl = tile.querySelector('a.product-image-link, a[href*="/p/"], a[href*="/product/"]') || tile.querySelector('a');
                        const imgEl = tile.querySelector('img.attachment-woocommerce_thumbnail, img');

                        if (titleEl) {
                            const title = titleEl.getAttribute('aria-label') || titleEl.innerText.trim();
                            let price = 0;
                            if (priceEl && priceEl.innerText) {
                                // WooCommerce price blocks often have del (old price) and ins (new price).
                                const newPriceEl = priceEl.querySelector('ins .amount') || priceEl.querySelector('.amount') || priceEl;
                                const priceText = newPriceEl.innerText.replace(/[^\d.]/g, '');
                                const priceMatch = priceText.match(/[\d.]+/);
                                price = priceMatch ? parseFloat(priceMatch[0]) : 0;
                            }

                            if (title && price > 0) {
                                results.push({
                                    raw_title: title,
                                    raw_price: price,
                                    raw_url: linkEl?.href || '',
                                    raw_image_url: imgEl?.src || imgEl?.getAttribute('data-src') || imgEl?.getAttribute('data-srcset')?.split(' ')[0] || ''
                                });
                            }
                        }
                    });
                    return results;
                });

                if (products.length === 0) {
                    console.error(`[Mayers] DEBUG: Blocked by security or DEBUG: Empty response. 0 products found.`);
                } else {
                    console.log(`[Mayers] Found ${products.length} products`);
                }
                resolve(products);
            } catch (err) {
                console.error(`[Mayers] Scrape error: ${err.message}`);
                resolve([]);
            }
        });
    }
}

module.exports = MayersAgent;
