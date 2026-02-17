const BaseScraper = require('./base-scraper');

class KSPScraper extends BaseScraper {
    constructor(searchTerm) {
        const query = searchTerm;
        if (!query) throw new Error("Search term is required for KSPScraper");
        super('KSP', `https://ksp.co.il/web/search?q=${encodeURIComponent(query)}`);
    }

    async parse(page) {
        let products = [];

        // KSP is heavily dynamic. Data usually comes via API.
        // We'll try to extract it from the window if possible, or wait for the grid.
        try {
            await page.waitForSelector('div[data-role="product-item"], .product-card', { timeout: 10000 });
        } catch (e) { }

        return await page.evaluate(() => {
            const results = [];
            // KSP DOM structure is complex, but we can look for specific attributes
            const items = document.querySelectorAll('div[data-role="product-item"], .product-card');

            items.forEach(item => {
                const titleEl = item.querySelector('h3, .product-title, a');
                const priceEl = item.querySelector('.price, .product-price, b');
                const linkEl = item.querySelector('a');

                if (titleEl && linkEl) {
                    const title = titleEl.innerText.trim();
                    const link = linkEl.href;
                    let price = 0;

                    if (priceEl) {
                        const priceText = priceEl.innerText;
                        const numbers = priceText.match(/[0-9.]+/g);
                        if (numbers && numbers.length > 0) {
                            price = parseFloat(numbers[0]);
                        }
                    }

                    if (title && link && price > 0) {
                        results.push({
                            store: 'KSP',
                            title,
                            price,
                            link,
                            sizes: []
                        });
                    }
                }
            });
            return results;
        });
    }
}

module.exports = KSPScraper;
