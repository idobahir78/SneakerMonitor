const BaseScraper = require('./base-scraper');

class Factory54Scraper extends BaseScraper {
    constructor(searchTerm) {
        const query = searchTerm;
        if (!query) throw new Error("Search term is required for Factory54Scraper");
        super('Factory 54', `https://www.factory54.co.il/catalogsearch/result/?q=${encodeURIComponent(query)}`);
    }

    async parse(page) {
        // Wait for items to load
        try {
            await page.waitForSelector('.product-item, .card, div[data-id], .product_list_item', { timeout: 15000 });
        } catch (e) {
            console.log('Factory 54: No products found after wait.');
            return [];
        }

        return await page.evaluate(() => {
            const results = [];
            // Common selectors for F54: .product-item, .card, [data-id]
            const items = document.querySelectorAll('.product-item, .card, div[data-id], .product_list_item');

            items.forEach(item => {
                const linkEl = item.querySelector('a') || item.closest('a');
                const titleEl = item.querySelector('.product-name, .title, h3, h4, .product_item_title');
                const priceEl = item.querySelector('.price, .value, span[data-price], .product_item_price');

                if (linkEl && titleEl) {
                    const title = titleEl.innerText.trim();
                    const link = linkEl.href;
                    let priceText = priceEl ? priceEl.innerText.trim() : '0';
                    const numbers = priceText.match(/[0-9.]+/g);
                    let price = 0;
                    if (numbers && numbers.length > 0) {
                        price = Math.min(...numbers.map(n => parseFloat(n)));
                    }

                    const sizes = []; // Sizes verified via deep scrape

                    results.push({
                        store: 'Factory 54',
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
            const sizeEls = document.querySelectorAll('.size-selector .swatch, .size-attribute li, .sizes-list li');

            sizeEls.forEach(el => {
                if (!el.classList.contains('disabled') && !el.classList.contains('out-of-stock')) {
                    sizes.push(el.innerText.trim());
                }
            });

            if (sizes.length === 0) {
                const options = document.querySelectorAll('select[id*="size"] option');
                options.forEach(opt => {
                    if (!opt.disabled && opt.value) {
                        sizes.push(opt.innerText.trim());
                    }
                });
            }

            return sizes;
        });
    }
}

module.exports = Factory54Scraper;
