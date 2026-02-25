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
                    // Ensure we only select actual product grid items, ignoring nav menus
                    const tiles = document.querySelectorAll('.product-item-info, .product-item-details, .product-item');

                    tiles.forEach(tile => {
                        const linkEl = tile.querySelector('a.product-item-photo') || tile.querySelector('a');
                        const imgEl = tile.querySelector('img.product-image-photo, img');

                        let title = '';
                        let price = 0;

                        // Attempt exact JSON extraction from dataLayer push in onclick
                        if (linkEl) {
                            const onclickAttr = linkEl.getAttribute('onclick') || '';
                            const match = onclickAttr.match(/window\.dataLayer\.push\((.*?)\);/);
                            if (match && match[1]) {
                                try {
                                    const dlObj = JSON.parse(match[1]);
                                    if (dlObj.ecommerce?.click?.products?.[0]) {
                                        const pData = dlObj.ecommerce.click.products[0];
                                        title = pData.name;
                                        price = parseFloat(pData.price) || 0;
                                    }
                                } catch (e) { }
                            }
                        }

                        // Fallback to DOM string extraction
                        if (!title || price === 0) {
                            const titleEl = tile.querySelector('.product-item-link, .product-name');
                            const priceEl = tile.querySelector('.price-box .price, .price, .special-price .price');
                            title = title || (titleEl ? titleEl.innerText.trim() : '');

                            if (price === 0 && priceEl) {
                                const priceText = priceEl.getAttribute('data-price-amount') || priceEl.innerText.replace(/[^\d.]/g, '');
                                price = parseFloat(priceText) || 0;
                            }
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
