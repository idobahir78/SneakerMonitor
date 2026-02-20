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

        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
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

                const rawItems = [];

                this.page.on('request', req => {
                    const url = req.url();
                    if (url.includes('.png') || url.includes('.jpg') || url.includes('.gif') || url.includes('.woff')) {
                        req.abort();
                    } else {
                        req.continue();
                    }
                });

                await this.navigateWithRetry(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

                const products = await this.page.evaluate(() => {
                    const results = [];
                    const tiles = document.querySelectorAll('.b-product_tile, .product-tile, [data-pid]');

                    tiles.forEach(tile => {
                        const titleEl = tile.querySelector('.product-item-details a, .product-item-name a, .product-item-link span, .b-product_tile-name a') || tile.querySelector('h2 a, h3 a');
                        const priceEl = tile.querySelector('.b-price-item, .sales .value, .price .value, [data-price]');
                        const linkEl = tile.querySelector('a[href*="/p/"], a[href*="factory54.co.il"]') || tile.querySelector('a');
                        const imgEl = tile.querySelector('img');

                        const title = titleEl?.innerText?.trim() || titleEl?.textContent?.trim();
                        if (!title || title.includes('הוספה לסל') || title.includes('הוסף')) return;

                        const priceText = priceEl?.innerText?.trim() || priceEl?.getAttribute('content') || '0';
                        const priceMatch = priceText.replace(/,/g, '').match(/[\d.]+/);
                        const price = priceMatch ? parseFloat(priceMatch[0]) : 0;

                        results.push({
                            raw_title: title,
                            raw_price: price,
                            raw_image_url: imgEl?.src || imgEl?.getAttribute('data-src') || null,
                            raw_url: linkEl?.href || null,
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
