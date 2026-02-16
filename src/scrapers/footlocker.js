const BaseScraper = require('./base-scraper');

class FootLockerScraper extends BaseScraper {
    constructor(searchTerm) {
        // console.log(`[Foot Locker] Constructor received searchTerm: "${searchTerm}"`);
        const query = searchTerm || 'puma lamelo';
        super('Foot Locker IL', `https://www.footlocker.co.il/search?q=${encodeURIComponent(query)}`);
    }

    async parse(page) {
        return await page.evaluate(() => {
            const results = [];
            const items = document.querySelectorAll('product-item');

            items.forEach(item => {
                const titleEl = item.querySelector('.product-item-meta__title');
                const priceEl = item.querySelector('.price--highlight, .price');

                if (titleEl) {
                    const title = titleEl.innerText.trim();
                    const link = titleEl.href;
                    let priceText = priceEl ? priceEl.innerText.trim() : '0';

                    // Clean up price (remove currency symbols like ₪)
                    const numbers = priceText.replace(/[^\d.]/g, '').match(/[0-9.]+/g);
                    let price = 0;
                    if (numbers && numbers.length > 0) {
                        price = parseFloat(numbers[0]);
                    }

                    const sizes = []; // Sizes verified via deep scrape

                    results.push({
                        store: 'Foot Locker IL',
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
