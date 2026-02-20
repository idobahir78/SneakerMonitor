const DOMNavigator = require('./DOMNavigator');

const PUPPETEER_LAUNCH_ARGS = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--window-size=1920x1080'
];

class Factory54Agent extends DOMNavigator {
    constructor() {
        super('Factory 54', 'https://www.factory54.co.il');
    }

    async init() {
        const puppeteer = require('puppeteer-extra');
        const StealthPlugin = require('puppeteer-extra-plugin-stealth');
        puppeteer.use(StealthPlugin());

        this.browser = await puppeteer.launch({
            headless: 'new',
            args: PUPPETEER_LAUNCH_ARGS
        });
        this.page = await this.browser.newPage();

        this.page.setDefaultNavigationTimeout(60000);
        this.page.setDefaultTimeout(60000);

        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        await this.page.setViewport({ width: 1920, height: 1080 });
        await this.page.setExtraHTTPHeaders({
            'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
            'Referer': 'https://www.factory54.co.il/men',
            'X-Requested-With': 'XMLHttpRequest'
        });
        console.log(`[Factory 54] Isolated init completed`);
    }

    async scrape(brand, model) {
        const query = encodeURIComponent(`${brand} ${model}`);
        const searchUrl = `${this.targetUrl}/on/demandware.store/Sites-factory54-Site/iw_IL/Search-Show?q=${query}&lang=iw_IL&start=0&sz=36&format=ajax`;

        return new Promise(async (resolve, reject) => {
            const timeout = setTimeout(() => {
                console.warn(`[Factory 54] Scrape timed out.`);
                resolve([]);
            }, 60000);

            try {
                await this.page.setRequestInterception(true);

                this.page.on('request', req => {
                    const url = req.url();
                    if (url.includes('.png') || url.includes('.jpg') || url.includes('.gif') || url.includes('.woff')) {
                        req.abort();
                    } else {
                        req.continue();
                    }
                });

                await this.navigateWithRetry(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

                await new Promise(r => setTimeout(r, 5000));

                const diagnostic = await this.page.evaluate(() => {
                    const bodyText = document.body?.innerText || '';
                    const bodyClass = document.body?.className || '';
                    const iframeCount = document.querySelectorAll('iframe').length;
                    const allElements = document.querySelectorAll('*');
                    const classesWithProduct = [];
                    allElements.forEach(el => {
                        if (el.className && typeof el.className === 'string' && el.className.includes('product')) {
                            classesWithProduct.push({
                                tag: el.tagName,
                                className: el.className.substring(0, 120),
                                childCount: el.children.length
                            });
                        }
                    });

                    const allLinks = [...document.querySelectorAll('a')].slice(0, 10).map(a => ({
                        href: a.getAttribute('href')?.substring(0, 100),
                        text: a.innerText?.substring(0, 50)
                    }));

                    return {
                        bodyContentLength: bodyText.length,
                        bodyTextSnippet: bodyText.substring(0, 500),
                        bodyClass: bodyClass.substring(0, 200),
                        iframeCount,
                        classesWithProduct: classesWithProduct.slice(0, 15),
                        firstLinks: allLinks
                    };
                });

                console.log(`[Factory 54] DEBUG: Page Content Length: ${diagnostic.bodyContentLength} chars`);
                console.log(`[Factory 54] DEBUG: Body class: "${diagnostic.bodyClass}"`);
                console.log(`[Factory 54] DEBUG: Iframes: ${diagnostic.iframeCount}`);
                console.log(`[Factory 54] DEBUG: Elements with 'product' class: ${JSON.stringify(diagnostic.classesWithProduct)}`);
                console.log(`[Factory 54] DEBUG: First links: ${JSON.stringify(diagnostic.firstLinks)}`);
                console.log(`[Factory 54] DEBUG: Body text snippet: "${diagnostic.bodyTextSnippet.substring(0, 300)}"`);

                const products = await this.page.evaluate(() => {
                    function norm(u) {
                        if (!u) return '';
                        u = u.trim();
                        if (u.startsWith('http')) return u;
                        if (u.startsWith('//')) return 'https:' + u;
                        if (u.startsWith('/')) return 'https://www.factory54.co.il' + u;
                        return 'https://www.factory54.co.il/' + u;
                    }

                    const results = [];
                    const tiles = document.querySelectorAll('.product-item-info, .b-product_tile, .product-tile, [data-pid]');

                    tiles.forEach(tile => {
                        const nameEl = tile.querySelector('.product-item-details .product-item-link')
                            || tile.querySelector('.product-item-name a')
                            || tile.querySelector('.b-product_tile-name a')
                            || tile.querySelector('.b-product_tile-link');

                        if (!nameEl) return;

                        const title = nameEl.innerText?.trim() || nameEl.textContent?.trim() || '';
                        if (!title || title.includes('הוספה לסל') || title.includes('הוסף') || title.length < 3) return;

                        const priceEl = tile.querySelector('.b-price-item, .sales .value, .price .value, [data-price]');
                        const imgEl = tile.querySelector('img');

                        const priceText = priceEl?.innerText?.trim() || priceEl?.getAttribute('content') || '0';
                        const priceMatch = priceText.replace(/,/g, '').match(/[\d.]+/);
                        const price = priceMatch ? parseFloat(priceMatch[0]) : 0;

                        const linkHref = nameEl.getAttribute('href')
                            || tile.querySelector('a[href*="/p/"]')?.getAttribute('href')
                            || tile.querySelector('a')?.getAttribute('href')
                            || '';

                        results.push({
                            raw_title: title,
                            raw_price: price,
                            raw_image_url: norm(imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || ''),
                            raw_url: norm(linkHref),
                            raw_sizes: [],
                        });
                    });

                    return results;
                });

                clearTimeout(timeout);
                console.log(`[Factory 54] Scraped ${products.length} products.`);
                resolve(products);

            } catch (err) {
                clearTimeout(timeout);
                console.error(`[Factory 54] Scrape error: ${err.message}`);
                resolve([]);
            }
        });
    }
}

module.exports = Factory54Agent;
