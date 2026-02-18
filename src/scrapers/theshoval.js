const BaseScraper = require('./base-scraper');

class TheShovalScraper extends BaseScraper {
    constructor(searchTerm) {
        const query = searchTerm;
        if (!query) throw new Error("Search term is required for TheShovalScraper");
        super('The Shoval', `https://theshoval.com/search?q=${encodeURIComponent(query)}`);
    }

    async navigate(page) {
        // Use consistent successful UA
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
        await super.navigate(page);
    }

    async parse(page) {
        return await page.evaluate(() => {
            const results = [];
            // Shopify Dawn Theme Selectors
            const items = document.querySelectorAll('.card-wrapper, .product-card-wrapper, .product-item');

            items.forEach(item => {
                const titleEl = item.querySelector('.card__heading a, .full-unstyled-link, .product-title');
                const priceEl = item.querySelector('.price__sale .price-item--last, .price__regular .price-item--regular, .price .amount');
                const linkEl = item.querySelector('a.full-unstyled-link, a.product-card__link');

                if (titleEl) {
                    const title = titleEl.innerText.trim();
                    const link = linkEl ? linkEl.href : titleEl.href;
                    let price = 0;

                    if (priceEl) {
                        const priceText = priceEl.innerText;
                        const numbers = priceText.replace(/[^\d.]/g, '').match(/[0-9.]+/g);
                        if (numbers && numbers.length > 0) {
                            price = parseFloat(numbers[0]);
                        }
                    }

                    if (title && price > 0) {
                        const sizes = []; // Deep scrape handles sizes
                        results.push({
                            store: 'The Shoval',
                            title,
                            price,
                            link,
                            sizes
                        });
                    }
                }
            });
            return results;
        });
    }

    async parseSizes(page) {
        return await page.evaluate(() => {
            const sizes = [];
            // Generic selectors for small sites (often Shopify-like)
            const sizeEls = document.querySelectorAll('.swatch-element:not(.soldout) label, .size-selector li:not(.out-of-stock)');

            sizeEls.forEach(el => sizes.push(el.innerText.trim()));

            if (sizes.length === 0) {
                // Try dropdown
                const options = document.querySelectorAll('select[name*="id"] option, select[name*="size"] option');
                options.forEach(opt => {
                    // Check if not disabled and not "Select Size"
                    if (!opt.disabled && opt.value && opt.innerText.match(/[0-9]/)) {
                        sizes.push(opt.innerText.trim());
                    }
                });
            }
            return sizes;
        });
    }
}

module.exports = TheShovalScraper;
