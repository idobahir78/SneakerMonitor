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

                const diagnostic = await this.page.evaluate(() => {
                    const tiles = document.querySelectorAll('.product-item');
                    const firstTwo = [...tiles].slice(0, 2);
                    const tilesDump = firstTwo.map((tile, i) => {
                        const allAnchors = [...tile.querySelectorAll('a')];
                        const anchorInfo = allAnchors.map(a => ({
                            href: a.getAttribute('href'),
                            className: a.className,
                            dataHref: a.getAttribute('data-href'),
                            dataUrl: a.getAttribute('data-url'),
                            textSnippet: a.innerText?.substring(0, 50)
                        }));
                        return {
                            index: i,
                            outerHTMLSnippet: tile.outerHTML.substring(0, 800),
                            anchors: anchorInfo
                        };
                    });

                    return {
                        title: document.title,
                        url: window.location.href,
                        totalTiles: tiles.length,
                        bodyContentLength: document.body?.innerText?.length || 0,
                        tilesDump
                    };
                });

                console.log(`[Foot Locker Israel] DEBUG: title="${diagnostic.title}", url="${diagnostic.url}"`);
                console.log(`[Foot Locker Israel] DEBUG: Total .product-item tiles: ${diagnostic.totalTiles}`);
                console.log(`[Foot Locker Israel] DEBUG: Page Content Length: ${diagnostic.bodyContentLength} chars`);

                for (const tile of diagnostic.tilesDump) {
                    console.log(`[Foot Locker Israel] TILE ${tile.index} outerHTML: ${tile.outerHTMLSnippet}`);
                    console.log(`[Foot Locker Israel] TILE ${tile.index} anchors: ${JSON.stringify(tile.anchors)}`);
                }

                const products = await this.page.evaluate((baseDomain) => {
                    function norm(u) {
                        if (!u) return '';
                        u = u.trim();
                        if (u.startsWith('http')) return u;
                        if (u.startsWith('//')) return 'https:' + u;
                        if (u.startsWith('/') && !u.includes(baseDomain.replace('https://', ''))) return baseDomain + u;
                        if (u.startsWith('/')) return 'https:' + u;
                        return baseDomain + '/' + u;
                    }

                    const results = [];
                    const tiles = document.querySelectorAll('.product-item');

                    tiles.forEach(tile => {
                        let productUrl = '';
                        const allAnchors = [...tile.querySelectorAll('a')];
                        for (const a of allAnchors) {
                            const h = a.getAttribute('href') || '';
                            if (h.includes('/products/')) {
                                productUrl = h;
                                break;
                            }
                        }
                        if (!productUrl) {
                            for (const a of allAnchors) {
                                const h = a.getAttribute('href') || '';
                                if (h && h !== '#' && h !== 'javascript:void(0)' && !h.startsWith('mailto:')) {
                                    productUrl = h;
                                    break;
                                }
                            }
                        }
                        productUrl = norm(productUrl);

                        const titleEl = tile.querySelector('.product-item__title, .product-item__link, h3, h2, [class*="title"]');
                        const priceEl = tile.querySelector('.price__current, .product-item__price, .price .money, .price, .money');
                        const imgEl = tile.querySelector('.product-item__primary-image, img');

                        let title = titleEl?.innerText?.trim() || '';
                        if (!title && productUrl) {
                            const slug = productUrl.split('/products/')[1]?.split('?')[0] || '';
                            title = slug.replace(/-/g, ' ');
                        }

                        if (title) {
                            let price = 0;
                            if (priceEl) {
                                const priceText = priceEl.innerText.replace(/[^\d.]/g, '');
                                price = parseFloat(priceText) || 0;
                            }

                            const rawImg = norm(imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || imgEl?.getAttribute('srcset')?.split(' ')[0] || '');

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
                    console.log(`[Foot Locker Israel] First item URL: "${products[0]?.raw_url}"`);
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
