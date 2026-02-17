const BaseScraper = require('./base-scraper');

class FootLockerScraper extends BaseScraper {
    constructor(searchTerm) {
        const query = searchTerm;
        if (!query) throw new Error("Search term is required for FootLockerScraper");
        super('Foot Locker IL', `https://www.footlocker.co.il/search?q=${encodeURIComponent(query)}`);
    }

    async parse(page) {
        return await page.evaluate(() => {
            const results = [];

            // 1. Check for PDP (Product Detail Page) indicators
            const isPDP = !!document.querySelector('.product-form') || !!document.querySelector('.product-single__title') || !!document.querySelector('[data-product-id]');

            if (isPDP) {
                const titleEl = document.querySelector('.product-single__title, h1.product_title, .product-details h1');
                const priceEl = document.querySelector('.product__price, .price-item--regular, .product-details .price');

                if (titleEl) {
                    const title = titleEl.innerText.trim();
                    const link = window.location.href;
                    let price = 0;
                    if (priceEl) {
                        const priceText = priceEl.innerText.trim();
                        const numbers = priceText.replace(/[^\d.]/g, '').match(/[0-9.]+/g);
                        if (numbers && numbers.length > 0) price = parseFloat(numbers[0]);
                    }

                    results.push({
                        store: 'Foot Locker IL',
                        title,
                        price,
                        link,
                        sizes: []
                    });
                    return results;
                }
            }

            // 2. PLP (Product Listing Page) Parsing
            const items = document.querySelectorAll('.product-card, .product-item, .grid-view-item, .card-wrapper');

            items.forEach(item => {
                const titleEl = item.querySelector('.product-card__title, .grid-view-item__title, .card__heading, h3 a');
                const priceEl = item.querySelector('.price-item--regular, .product-card__price, .price');
                const linkEl = item.querySelector('a.full-unstyled-link, a.grid-view-item__link, .product-card__title');

                if (titleEl) {
                    const title = titleEl.innerText.trim();
                    let link = linkEl ? linkEl.href : '';
                    if (!link) {
                        // heavy strategy
                        const a = item.querySelector('a');
                        if (a) link = a.href;
                    }

                    // If relative, make absolute
                    if (link && link.startsWith('/')) {
                        link = `https://www.footlocker.co.il${link}`;
                    }

                    let priceText = priceEl ? priceEl.innerText.trim() : '0';

                    // Parse price
                    const numbers = priceText.replace(/[^\d.]/g, '').match(/[0-9.]+/g);
                    let price = 0;
                    if (numbers && numbers.length > 0) {
                        price = parseFloat(numbers[0]);
                    }

                    if (title && link) {
                        results.push({
                            store: 'Foot Locker IL',
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

    async parseSizes(page) {
        return await page.evaluate(() => {
            const sizes = [];
            // Common Foot Locker selectors: .c-form-field--radio-pill or .ProductSize-group
            const sizeEls = document.querySelectorAll('.c-form-field--radio-pill label, .ProductSize-group .c-form-field__label');

            sizeEls.forEach(el => {
                const inputId = el.getAttribute('for');
                if (inputId) {
                    const input = document.getElementById(inputId);
                    if (input && !input.disabled) {
                        sizes.push(el.innerText.trim());
                    }
                } else {
                    sizes.push(el.innerText.trim());
                }
            });
            return sizes;
        });
    }
}

module.exports = FootLockerScraper;
