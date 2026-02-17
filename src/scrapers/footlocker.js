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
            // Robust selectors for Foot Locker IL (Shopify/Liquid based)
            const items = document.querySelectorAll('product-item, .product-item, .product-card, .grid-view-item');

            items.forEach(item => {
                const titleEl = item.querySelector('.product-item-meta__title, .product-card__title, .grid-view-item__title, h3, a[href*="/products/"]');
                const priceEl = item.querySelector('.price--highlight, .price, .product-card__price, .grid-view-item__meta');
                const linkEl = item.querySelector('a[href*="/products/"]');

                if (titleEl) {
                    const title = titleEl.innerText.trim();
                    let link = linkEl ? linkEl.href : '';
                    if (!link && titleEl.tagName === 'A') link = titleEl.href;

                    // If relative, make absolute (though .href is usually absolute in puppeteer)
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
