const BaseScraper = require('./base-scraper');

class MasterSportScraper extends BaseScraper {
    constructor(searchTerm) {
        const query = searchTerm;
        if (!query) throw new Error("Search term is required for MasterSportScraper");
        super('Master Sport', `https://mastersport.co.il/?s=${encodeURIComponent(query)}&post_type=product`);
    }

    async parse(page) {
        return await page.evaluate(() => {
            const items = [];
            const elements = document.querySelectorAll('.product-item, li.product');

            elements.forEach(el => {
                const titleEl = el.querySelector('.name, .woocommerce-loop-product__title');
                const linkEl = el.querySelector('.name, .woocommerce-loop-product__title, a.woocommerce-LoopProduct-link');
                const priceEl = el.querySelector('.price');

                if (titleEl && linkEl) {
                    const title = titleEl.innerText.trim();
                    const link = linkEl.href;
                    let price = 0;

                    if (priceEl) {
                        // Check for sale price first (ins)
                        const insPrice = priceEl.querySelector('ins .amount bdi');
                        // Fallback to regular price if no sale price
                        const regularPrice = priceEl.querySelector('.amount bdi');

                        const priceElementToUse = insPrice || regularPrice;

                        if (priceElementToUse) {
                            // Extract just the number, removing currency symbol and other chars
                            const priceText = priceElementToUse.innerText;
                            price = parseFloat(priceText.replace(/[^\d.]/g, ''));
                        }
                    }

                    const isOutOfStock = el.classList.contains('outofstock') ||
                        (el.innerText && el.innerText.includes('אזל במלאי'));

                    if (title && price > 0 && !isOutOfStock) {
                        items.push({
                            store: 'Master Sport',
                            title,
                            price,
                            link,
                            sizes: []
                        });
                    }
                }
            });
            return items;
        });
    }

    async parseSizes(page) {
        return await page.evaluate(() => {
            const sizes = [];
            const sizeEls = document.querySelectorAll('.variable-items-wrapper .variable-item:not(.disabled), .swatch-wrapper .swatch:not(.disabled)');
            sizeEls.forEach(el => sizes.push(el.innerText.trim()));
            return sizes;
        });
    }
}

module.exports = MasterSportScraper;
