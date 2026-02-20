const DOMNavigator = require('./DOMNavigator');

class FootLockerIsraelAgent extends DOMNavigator {
    constructor() {
        super('Foot Locker Israel', 'https://footlocker.co.il');
    }

    async scrape(brand, model) {
        const query = encodeURIComponent(`${brand} ${model}`);
        const searchUrl = `${this.targetUrl}/search?q=${query}`;
        const domain = this.targetUrl;

        return new Promise(async (resolve) => {
            try {
                console.log(`[Foot Locker Israel] Navigating to: ${searchUrl}`);
                await this.navigateWithRetry(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

                try {
                    await this.page.waitForSelector('.product-item, .product-card', { timeout: 30000 });
                } catch (e) {
                    console.log('[Foot Locker Israel] Timeout waiting for product containers.');
                }

                const debugInfo = await this.page.evaluate(() => ({
                    title: document.title,
                    url: window.location.href,
                    productClasses: [...document.querySelectorAll('[class*="product-item"]')].map(el => el.className).slice(0, 5)
                }));
                console.log(`[Foot Locker Israel] DEBUG: title="${debugInfo.title}", url="${debugInfo.url}"`);
                console.log(`[Foot Locker Israel] DEBUG: Product classes: ${JSON.stringify(debugInfo.productClasses)}`);

                const products = await this.page.evaluate((baseDomain) => {
                    function norm(u) {
                        if (!u) return '';
                        u = u.trim();
                        if (u.startsWith('http')) return u;
                        if (u.startsWith('//')) return 'https:' + u;
                        if (u.startsWith('/')) return baseDomain + u;
                        return baseDomain + '/' + u;
                    }

                    const results = [];
                    const tiles = document.querySelectorAll('.product-item, .product-card');

                    tiles.forEach(tile => {
                        let productUrl = '';
                        const allLinks = tile.querySelectorAll('a');
                        for (const a of allLinks) {
                            const h = a.getAttribute('href') || '';
                            if (h.includes('/products/')) {
                                productUrl = h;
                                break;
                            }
                        }
                        if (!productUrl) {
                            const firstA = tile.querySelector('a');
                            if (firstA) productUrl = firstA.getAttribute('href') || '';
                        }
                        productUrl = norm(productUrl);

                        const titleEl = tile.querySelector('.product-item__title, .product-item__link, .product-card__title, h3, h2');
                        const priceEl = tile.querySelector('.price__current, .product-item__price, .price, .money');
                        const imgEl = tile.querySelector('.product-item__primary-image, img');

                        let title = titleEl?.innerText?.trim() || '';
                        if (!title && productUrl) {
                            const slug = productUrl.split('/products/')[1]?.split('?')[0] || '';
                            title = slug.replace(/-/g, ' ');
                        }

                        if (title && productUrl) {
                            let price = 0;
                            if (priceEl) {
                                const priceText = priceEl.innerText.replace(/[^\d.]/g, '');
                                price = parseFloat(priceText) || 0;
                            }

                            const rawImg = norm(imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || '');

                            results.push({
                                raw_title: title,
                                raw_price: price,
                                raw_url: productUrl,
                                raw_image_url: rawImg
                            });
                        }
                    });
                    return results;
                }, domain);

                if (products.length === 0) {
                    console.error(`[Foot Locker Israel] DEBUG: Blocked by security or empty response. 0 products.`);
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
