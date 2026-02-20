const DOMNavigator = require('./DOMNavigator');

class PumaIsraelAgent extends DOMNavigator {
    constructor() {
        super('Puma Israel', 'https://il.puma.com');
    }

    async scrape(brand, model) {
        if (brand.toLowerCase() !== 'puma') return [];
        const query = encodeURIComponent(`${brand} ${model}`);
        const searchUrl = `${this.targetUrl}/il/he/search?q=${query}`;
        const domain = this.targetUrl;

        let interceptedItems = [];
        let apiDataCaptured = false;
        let jsonResponses = [];

        return new Promise(async (resolve) => {
            try {
                this.page.on('response', async (response) => {
                    try {
                        const contentType = response.headers()['content-type'] || '';
                        const url = response.url();

                        if (contentType.includes('application/json')) {
                            jsonResponses.push({
                                url: url.substring(0, 200),
                                status: response.status()
                            });

                            if (!apiDataCaptured) {
                                const data = await response.json();
                                const products = this.findPumaProducts(data);

                                if (products && products.length > 0) {
                                    interceptedItems = interceptedItems.concat(products);
                                    apiDataCaptured = true;
                                    console.log(`[Puma Israel] Intercepted API with ${products.length} items from: ${url.substring(0, 150)}`);
                                }
                            }
                        }
                    } catch (e) { }
                });

                console.log(`[Puma Israel] Navigating to: ${searchUrl}`);
                await this.navigateWithRetry(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

                await new Promise(r => setTimeout(r, 10000));

                console.log(`[Puma Israel] DEBUG: Total JSON responses captured: ${jsonResponses.length}`);
                jsonResponses.forEach((r, i) => {
                    console.log(`[Puma Israel] JSON Response ${i}: [${r.status}] ${r.url}`);
                });

                if (apiDataCaptured && interceptedItems.length > 0) {
                    return resolve(interceptedItems);
                }

                try { await this.page.waitForSelector('.product-tile, [class*="product-tile"]', { timeout: 10000 }); } catch (e) { }

                const diagnostic = await this.page.evaluate(() => {
                    const breadcrumb = document.querySelector('.product-breadcrumb');
                    return {
                        title: document.title,
                        url: window.location.href,
                        bodyContentLength: document.body?.innerText?.length || 0,
                        bodyClassList: document.body?.className || '',
                        breadcrumbHTML: breadcrumb?.outerHTML?.substring(0, 300) || 'NOT FOUND',
                        allClassesWithProduct: [...document.querySelectorAll('[class*="product"]')].map(el => ({
                            tag: el.tagName,
                            className: el.className.substring(0, 100)
                        })).slice(0, 15),
                        iframeCount: document.querySelectorAll('iframe').length,
                        bodyTextSnippet: document.body?.innerText?.substring(0, 500) || ''
                    };
                });

                console.log(`[Puma Israel] DEBUG: title="${diagnostic.title}", url="${diagnostic.url}"`);
                console.log(`[Puma Israel] DEBUG: Page Content Length: ${diagnostic.bodyContentLength} chars`);
                console.log(`[Puma Israel] DEBUG: Body class: "${diagnostic.bodyClassList.substring(0, 200)}"`);
                console.log(`[Puma Israel] DEBUG: Breadcrumb HTML: ${diagnostic.breadcrumbHTML}`);
                console.log(`[Puma Israel] DEBUG: Elements with 'product' class: ${JSON.stringify(diagnostic.allClassesWithProduct)}`);
                console.log(`[Puma Israel] DEBUG: Iframes: ${diagnostic.iframeCount}`);
                console.log(`[Puma Israel] DEBUG: Body text snippet: "${diagnostic.bodyTextSnippet.substring(0, 300)}"`);

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
                    const tiles = document.querySelectorAll('.product-tile, [class*="ProductCard"], [class*="product-card"]');

                    tiles.forEach(tile => {
                        const linkEl = tile.querySelector('a.product-tile__link, a[href*="/pd/"], a') || tile.querySelector('a');
                        const titleEl = tile.querySelector('.product-tile__title, .product-tile-title, h3, h2') || linkEl;
                        const priceEl = tile.querySelector('.product-tile__price .value, [class*="price"] .value, [class*="price"]');
                        const imgEl = tile.querySelector('img.tile-image, img');

                        if (titleEl) {
                            results.push({
                                raw_title: titleEl.innerText.trim(),
                                raw_price: priceEl ? parseFloat(priceEl.innerText.replace(/[^\d.]/g, '')) || 0 : 0,
                                raw_url: norm(linkEl?.getAttribute('href') || ''),
                                raw_image_url: norm(imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || '')
                            });
                        }
                    });
                    return results;
                }, domain);

                if (products.length === 0 && interceptedItems.length === 0) {
                    console.error(`[Puma Israel] DEBUG: Blocked by security or empty response. 0 products.`);
                } else {
                    console.log(`[Puma Israel] Found ${products.length} products via DOM`);
                }

                resolve(interceptedItems.length > 0 ? interceptedItems : products);
            } catch (err) {
                console.error(`[Puma Israel] Scrape error: ${err.message}`);
                resolve([]);
            }
        });
    }

    findPumaProducts(obj, depth = 0) {
        if (depth > 6 || !obj || typeof obj !== 'object') return [];
        let items = [];

        if (Array.isArray(obj)) {
            for (const item of obj) {
                if (item && (item.name || item.title || item.productName) && (item.price || item.salePrice || item.listPrice || item.formattedPrice)) {
                    const priceVal = item.salePrice || item.price || item.listPrice;
                    if (priceVal && !isNaN(parseFloat(priceVal))) {
                        items.push({
                            raw_title: item.name || item.title || item.productName || '',
                            raw_price: parseFloat(priceVal),
                            raw_url: item.url || item.pdpUrl || item.productUrl || '',
                            raw_image_url: item.image?.url || item.imageUrl || item.thumbnail || item.image?.link || ''
                        });
                    }
                } else {
                    items = items.concat(this.findPumaProducts(item, depth + 1));
                }
            }
        } else {
            if (obj.items || obj.products || obj.hits || obj.results || obj.searchResults) {
                const space = obj.items || obj.products || obj.hits || obj.results || obj.searchResults;
                items = items.concat(this.findPumaProducts(space, depth + 1));
            } else {
                for (const key of Object.keys(obj)) {
                    if (key !== 'aggregations' && key !== 'facets' && key !== 'refinements') {
                        items = items.concat(this.findPumaProducts(obj[key], depth + 1));
                    }
                }
            }
        }
        return items;
    }
}

module.exports = PumaIsraelAgent;
