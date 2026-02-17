const BaseScraper = require('./base-scraper');

class PlayerSixScraper extends BaseScraper {
    constructor(searchTerm) {
        const query = searchTerm;
        if (!query) throw new Error("Search term is required for PlayerSixScraper");
        super('Player Six', `https://playersix.co.il/?s=${encodeURIComponent(query)}&post_type=product`);
    }

    async parse(page) {
        return await page.evaluate(() => {
            const results = [];
            const items = document.querySelectorAll('.product-small, .product.type-product');

            items.forEach(item => {
                const titleEl = item.querySelector('.name a, .woocommerce-loop-product__title');
                const priceEl = item.querySelector('.price');
                const linkEl = item.querySelector('a.woocommerce-LoopProduct-link');

                if (titleEl) {
                    const title = titleEl.innerText.trim();
                    const link = linkEl ? linkEl.href : titleEl.href;

                    let priceText = '0';
                    if (priceEl) {
                        const amountEls = priceEl.querySelectorAll('.woocommerce-Price-amount');
                        if (amountEls.length > 0) {
                            priceText = amountEls[amountEls.length - 1].innerText;
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
                        store: 'Player Six',
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
            // Common WordPress/WooCommerce selectors
            const sizeEls = document.querySelectorAll('.swatch-element:not(.soldout) label, .variable-item:not(.disabled)');

            sizeEls.forEach(el => sizes.push(el.innerText.trim()));

            if (sizes.length === 0) {
                const options = document.querySelectorAll('select[id*="size"] option, select[name*="attribute_pa_size"] option');
                options.forEach(opt => {
                    if (!opt.disabled && opt.value && opt.innerText.match(/[0-9]/)) {
                        sizes.push(opt.innerText.trim());
                    }
                });
            }
            return sizes;
        });
    }
}

module.exports = PlayerSixScraper;
