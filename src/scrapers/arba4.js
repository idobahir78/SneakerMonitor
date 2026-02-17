const BaseScraper = require('./base-scraper');

class Arba4Scraper extends BaseScraper {
    constructor(searchTerm) {
        const query = searchTerm;
        if (!query) throw new Error("Search term is required for Arba4Scraper");
        super('Arba4', `https://arba4.co.il/?s=${encodeURIComponent(query)}&post_type=product`);
    }

    async parse(page) {
        return await page.evaluate(() => {
            const items = [];
            // 1. PDP Handling
            if (document.body.classList.contains('single-product')) {
                const titleEl = document.querySelector('h1.product_title');
                const priceEl = document.querySelector('p.price');

                if (titleEl) {
                    const title = titleEl.innerText.trim();
                    const link = window.location.href;
                    let price = 0;
                    if (priceEl) {
                        const insPrice = priceEl.querySelector('ins .amount');
                        const priceText = insPrice ? insPrice.innerText : priceEl.innerText;
                        const numbers = priceText.replace(/[^\d.]/g, '').match(/[0-9.]+/g);
                        if (numbers && numbers.length > 0) price = parseFloat(numbers[0]);
                    }

                    items.push({ store: 'Arba4', title, price, link, sizes: [] });
                    return items;
                }
            }

            // 2. Search Results
            const elements = document.querySelectorAll('li.product, .product-grid-item');

            elements.forEach(el => {
                const titleEl = el.querySelector('.woocommerce-loop-product__title, .product-title, h3, h2');
                const priceEls = el.querySelectorAll('.price bdi, .price .amount');
                const linkEl = el.querySelector('a.woocommerce-LoopProduct-link, a.product-link, a');

                if (titleEl && linkEl) {
                    const title = titleEl.innerText.trim();
                    const link = linkEl.href;
                    let price = 0;

                    if (priceEls.length > 0) {
                        const priceText = priceEls[priceEls.length - 1].innerText;
                        price = parseFloat(priceText.replace(/[^\d.]/g, ''));
                    }

                    const isOutOfStock = el.classList.contains('outofstock') ||
                        (el.innerText && el.innerText.includes('אזל במלאי'));

                    if (title && price && !isOutOfStock) {
                        items.push({ title, price, link, store: 'Arba4', sizes: [] });
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

module.exports = Arba4Scraper;
