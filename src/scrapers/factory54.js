const BaseScraper = require('./base-scraper');

class Factory54Scraper extends BaseScraper {
    constructor(searchTerm) {
        const query = searchTerm || 'puma lamelo';
        let url;

        // If searching for our main target (Puma/LaMelo), use the safe Brand Page
        if (query.toLowerCase().includes('puma') || query.toLowerCase().includes('lamelo')) {
            url = 'https://www.factory54.co.il/designers/men/puma';
        } else {
            // Otherwise, try the search URL (e.g. for "Wade")
            url = `https://www.factory54.co.il/search?q=${encodeURIComponent(query)}`;
        }

        super('Factory 54', url);
    }

    async parse(page) {
        return await page.evaluate(() => {
            const results = [];
            // Common selectors for F54: .product-item, .card, [data-id]
            // Based on visual debug finding "5 tiles" with .product_list_item or .product-tile
            const items = document.querySelectorAll('.product-item, .card, div[data-id]');

            items.forEach(item => {
                // F54 structure: Link often wraps the image/title
                // Selector strategy: find the first <a> that has "item" in href
                const linkEl = item.querySelector('a') || item.closest('a');
                const titleEl = item.querySelector('.product-name, .title, h3, h4');
                const priceEl = item.querySelector('.price, .value, span[data-price]');

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
            // F54 typically uses list items or buttons for sizes
            // Selector: .size-attribute .swatch-anchor, .ui-select-option
            const sizeEls = document.querySelectorAll('.size-selector .swatch, .size-attribute li, .sizes-list li');

            sizeEls.forEach(el => {
                // Check if not disabled/out of stock
                if (!el.classList.contains('disabled') && !el.classList.contains('out-of-stock')) {
                    sizes.push(el.innerText.trim());
                }
            });

            // Fallback: Check for a select dropdown
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
