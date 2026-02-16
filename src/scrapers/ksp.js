const BaseScraper = require('./base-scraper');

class KSPScraper extends BaseScraper {
    constructor(searchInput) {
        super(searchInput, 'KSP');
        this.baseUrl = 'https://ksp.co.il/';
        this.searchUrl = (query) => `https://ksp.co.il/web/search?q=${encodeURIComponent(query)}`;
    }

    async scrape(browser, targetModels, targetSizes) {
        return super.scrape(browser, targetModels, targetSizes);
    }

    async scrapePage(page, url, targetModels, targetSizes) {
        console.log(`[${this.storeName}] Navigating to: ${url}`);

        let products = [];

        // Setup request interception to catch API responses
        page.on('response', async (response) => {
            const reqUrl = response.url();
            // KSP usually fetches data from endpoints containing 'search' or 'items'
            if ((reqUrl.includes('/search') || reqUrl.includes('result')) &&
                response.headers()['content-type']?.includes('application/json')) {
                try {
                    const data = await response.json();
                    // Check for standard KSP API structure (often 'result.items' or similar)
                    const items = data.result?.items || data.items || data.products || [];

                    if (Array.isArray(items) && items.length > 0) {
                        console.log(`[${this.storeName}] Intercepted API response with ${items.length} items.`);

                        items.forEach(item => {
                            const title = item.name || item.title || item.sec_title;
                            const price = item.price || item.price_final;
                            const link = `https://ksp.co.il/web/item/${item.uin || item.id}`; // Construct link from ID
                            const image = item.img || item.img_url;

                            if (title && price) {
                                products.push({
                                    title: title,
                                    price: parseFloat(price),
                                    link: link,
                                    image: image,
                                    store: 'KSP'
                                });
                            }
                        });
                    }
                } catch (e) {
                    // Ignore parse errors
                }
            }
        });

        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
            // wait a bit more for any lazy API calls
            await new Promise(r => setTimeout(r, 5000));
        } catch (e) {
            console.log(`[${this.storeName}] Error navigating: ${e.message}`);
        }

        if (products.length === 0) {
            console.log(`[${this.storeName}] No products found via API interception. Fallback to basic DOM scan.`);
            // Basic fallback just in case
            products = await page.evaluate(() => {
                const items = [];
                document.querySelectorAll('div[data-role="product-item"], .product-card').forEach(el => {
                    const title = el.innerText.split('\n')[0]; // Gross simplification
                    items.push({ title, price: 0, link: window.location.href, store: 'KSP (Fallback)' });
                });
                return items;
            });
        }

        // Deduplicate
        const uniqueProducts = Array.from(new Set(products.map(p => p.link)))
            .map(link => products.find(p => p.link === link));

        console.log(`[${this.storeName}] Total unique items found: ${uniqueProducts.length}`);
        return uniqueProducts;
    }
}

module.exports = KSPScraper;
