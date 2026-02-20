const DOMNavigator = require('./DOMNavigator');

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
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--window-size=1920x1080'
            ]
        });
        this.page = await this.browser.newPage();

        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
        await this.page.setExtraHTTPHeaders({
            'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
            'Referer': 'https://www.factory54.co.il/men',
            'X-Requested-With': 'XMLHttpRequest'
        });
        console.log(`[Factory 54] Isolated init completed matching dump_f54_tile.js profile`);
    }

    async scrape(brand, model) {
        const query = encodeURIComponent(`${brand} ${model}`);
        // Bypass Cloudflare by hitting the Demandware AJAX fragment endpoint
        const searchUrl = `${this.targetUrl}/on/demandware.store/Sites-factory54-Site/iw_IL/Search-Show?q=${query}&lang=iw_IL&start=0&sz=36&format=ajax`;

        return new Promise(async (resolve, reject) => {
            try {
                console.log(`[Factory 54] Navigating to AJAX Search: ${searchUrl}`);
                const response = await this.page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
                const html = await response.text();

                // Save debug output
                try { require('fs').writeFileSync('f54-dump-ajax.html', html); } catch (e) { }

                // Determine if we still hit cloudflare or got actual HTML blocks
                if (html.length < 50000 && html.includes('Just a moment')) {
                    console.error('[Factory 54] Still blocked by Cloudflare even on AJAX endpoint.');
                    resolve([]);
                    return;
                }

                // Extract items using robust Node.js Regex against the raw HTML string
                const items = [];
                const gtmRegex = /data-gtm-product="([^"]+)"([\s\S]{1,1500})/g;

                let match;
                while ((match = gtmRegex.exec(html)) !== null) {
                    let raw_title = 'Unknown';
                    let raw_price = '0';
                    let raw_brand = 'Unknown';
                    let product_url = '';
                    let raw_image_url = '';

                    // 1. Extract JSON GTM metadata
                    try {
                        const gtmData = JSON.parse(match[1].replace(/&quot;/g, '"'));
                        raw_title = gtmData.item_name || raw_title;
                        raw_price = (gtmData.price || gtmData.salePrice || 0).toString();
                        raw_brand = gtmData.item_brand || raw_brand;
                    } catch (e) { }

                    // The following HTML chunk usually contains the link and image
                    const chunk = match[2];

                    // 2. Extract product URL
                    const linkMatch = chunk.match(/<a[^>]+href="([^"]+)"/i);
                    if (linkMatch) {
                        product_url = linkMatch[1];
                        if (!product_url.startsWith('http')) {
                            product_url = `https://www.factory54.co.il${product_url}`;
                        }
                    }

                    // 3. Extract image URL (Check for data-src first, then src)
                    const imgMatch = chunk.match(/<img[^>]*(?:data-src|src)="([^"]+)"/i);
                    if (imgMatch) {
                        raw_image_url = imgMatch[1];
                    }

                    // Only push if we have a URL and Title
                    if (product_url && raw_title !== 'Unknown') {
                        items.push({
                            raw_title: raw_title.replace(/\n|\r/g, '').trim(),
                            raw_price,
                            product_url,
                            raw_image_url,
                            raw_brand
                        });
                    }
                }

                console.log(`[Factory 54] Scraped ${items.length} raw items from AJAX HTML fragment via core regex.`);
                resolve(items);

            } catch (error) {
                console.error(`[Factory 54] Scrape Error:`, error.message);
                resolve([]); // Return whatever we managed to grab
            }
        });
    }
}

module.exports = Factory54Agent;
