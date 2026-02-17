const BaseScraper = require('./base-scraper');

class TheShovalScraper extends BaseScraper {
    constructor(searchTerm) {
        const query = searchTerm;
        if (!query) throw new Error("Search term is required for TheShovalScraper");
        super('The Shoval', `https://theshoval.com/search?q=${encodeURIComponent(query)}`);
    }

    async parse(page) {
        return await page.evaluate(() => {
            const results = [];
            // Selectors: .product-small usually wraps items in WordPress/WooCommerce themes
            const items = document.querySelectorAll('.product-small, .product-item');

            items.forEach(item => {
                const titleEl = item.querySelector('.name a, .woocommerce-loop-product__title');
                const priceEl = item.querySelector('.price');
                const linkEl = item.querySelector('a.woocommerce-LoopProduct-link');

                if (titleEl) {
                    const title = titleEl.innerText.trim();
                    const link = linkEl ? linkEl.href : titleEl.href;

                    let priceText = '0';
                    if (priceEl) {
                        // Handle ranges or sale prices (get the active/last price)
                        const amountEls = priceEl.querySelectorAll('.woocommerce-Price-amount');
                        if (amountEls.length > 0) {
                            priceText = amountEls[amountEls.length - 1].innerText; // Last one is usually final price
                        } else {
                            priceText = priceEl.innerText;
                        }
                    }

                    const numbers = priceText.match(/[0-9.]+/g);
                    let price = 0;
                    if (numbers && numbers.length > 0) {
                        price = Math.min(...numbers.map(n => parseFloat(n)));
                    }
                    const sizes = []; // Sizes verified via deep scrape

                    results.push({
                        store: 'The Shoval',
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
