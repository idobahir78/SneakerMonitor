const BaseScraper = require('./base-scraper');

class ZolSportScraper extends BaseScraper {
    constructor(searchTerm) {
        const query = searchTerm;
        if (!query) throw new Error("Search term is required for ZolSportScraper");
        super('Zol Sport', `https://zolsport.co.il/?s=${encodeURIComponent(query)}&post_type=product`);
    }

    async parse(page) {
        // Wait for product items (try multiple selectors)
        try {
            await page.waitForSelector('.product-item, li.product', { timeout: 10000 });
        } catch (e) {
            // No elements found
            return [];
        }

        return await page.evaluate(() => {
            const items = [];
            // Select all potential product containers
            const elements = document.querySelectorAll('.product-item, li.product');

            elements.forEach(el => {
                // Title
                const titleEl = el.querySelector('.caption-title a, .woocommerce-loop-product__title, h4 a');

                // Link
                const linkEl = el.querySelector('.media-link, .woocommerce-LoopProduct-link, a.product-link');

                // Price
                // Try to find specific price elements first
                let price = 0;
                const priceIns = el.querySelector('.price ins .amount, .price ins');
                const priceAmount = el.querySelector('.price .amount, .price');

                let priceText = '';
                if (priceIns) {
                    priceText = priceIns.innerText;
                } else if (priceAmount) {
                    priceText = priceAmount.innerText;
                }

                if (titleEl && linkEl) {
                    const title = titleEl.innerText.trim();
                    const link = linkEl.href;

                    if (priceText) {
                        price = parseFloat(priceText.replace(/[^\d.]/g, ''));
                    }

                    // Check for out of stock
                    const isOutOfStock = el.classList.contains('outofstock') ||
                        (el.innerText && el.innerText.includes('אזל במלאי'));

                    if (title && price > 0 && !isOutOfStock) {
                        items.push({ title, price, link, store: 'Zol Sport', sizes: [] });
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

module.exports = ZolSportScraper;
