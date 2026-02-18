const BaseScraper = require('./base-scraper');

class AlufSportScraper extends BaseScraper {
    constructor(searchTerm) {
        const query = searchTerm;
        if (!query) throw new Error("Search term is required for AlufSportScraper");
        super('Aluf Sport', `https://www.alufsport.co.il/?s=${encodeURIComponent(query)}&post_type=product`);
    }

    async navigate(page) {
        // Aluf Sport has strict bot protection. Use a specific, recent User-Agent that is known to work.
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
        await super.navigate(page);
    }

    async parse(page) {
        return await page.evaluate(() => {
            const items = [];

            // 1. Grid Handling (Primary for Search)
            const gridItems = document.querySelectorAll('.layout_list_item');
            if (gridItems.length > 0) {
                gridItems.forEach(el => {
                    const titleEl = el.querySelector('.title, .product_title, h3, h2');
                    const priceEl = el.querySelector('.price, .price_value');
                    const linkEl = el.querySelector('a');

                    if (titleEl && linkEl) {
                        const title = titleEl.innerText.trim();
                        const link = linkEl.href;
                        let price = 0;

                        if (priceEl) {
                            const priceText = priceEl.innerText;
                            const numbers = priceText.replace(/[^\d.]/g, '').match(/[0-9.]+/g);
                            if (numbers && numbers.length > 0) price = parseFloat(numbers[0]);
                        }

                        // Size parsing from grid if available (optional optimization)
                        const sizes = [];
                        // Sometimes sizes are in .size_list or similar, but for now deep scrape handles it.

                        items.push({ title, price, link, store: 'Aluf Sport', sizes });
                    }
                });
                return items;
            }

            // 2. PDP Handling (Fallback)
            if (document.body.classList.contains('single-product') || document.querySelector('#item_details')) {
                const titleEl = document.querySelector('h1.product_title, #item_details h1');
                const priceEl = document.querySelector('p.price, #item_details .price_value');

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

                    items.push({ store: 'Aluf Sport', title, price, link, sizes: [] });
                    return items;
                }
            }

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

module.exports = AlufSportScraper;
