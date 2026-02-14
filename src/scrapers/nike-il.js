const BaseScraper = require('./base-scraper');

class NikeILScraper extends BaseScraper {
    constructor(searchTerm) {
        const query = searchTerm || 'puma lamelo';
        // Nike search URL structure
        super('Nike IL', `https://www.nike.com/il/w?q=${encodeURIComponent(query)}`);
    }

    async parse(page) {
        // Nike is React-heavy, wait for grid
        try {
            await page.waitForSelector('.product-card, .product-grid__items', { timeout: 10000 });
        } catch (e) { }

        return await page.evaluate(() => {
            const results = [];
            const items = document.querySelectorAll('.product-card');

            items.forEach(item => {
                const titleEl = item.querySelector('.product-card__title');
                const priceEl = item.querySelector('.product-price');
                const linkEl = item.querySelector('a.product-card__link-overlay');

                if (titleEl && linkEl) {
                    const title = titleEl.innerText.trim();
                    const link = linkEl.href;
                    let price = 0;

                    if (priceEl) {
                        const priceText = priceEl.innerText;
                        const numbers = priceText.match(/[0-9.]+/g);
                        if (numbers && numbers.length > 0) {
                            price = Math.min(...numbers.map(n => parseFloat(n)));
                        }
                    }

                    const sizes = []; // Sizes verified via deep scrape

                    results.push({
                        store: 'Nike IL',
                        title,
                        price,
                        link,
                        sizes
                    });
                }
            });
            return results;
        });
    }

    async parseSizes(page) {
        return await page.evaluate(() => {
            const sizes = [];
            // Nike PDP selectors - Radio buttons usually
            const inputEls = document.querySelectorAll('input[name="skuAndSize"]');

            inputEls.forEach(input => {
                if (!input.disabled) {
                    // Label usually contains the size
                    const label = document.querySelector(`label[for="${input.id}"]`);
                    if (label) {
                        sizes.push(label.innerText.trim());
                    } else {
                        // Or value
                        sizes.push(input.value);
                    }
                }
            });
            return sizes;
        });
    }
}

module.exports = NikeILScraper;
