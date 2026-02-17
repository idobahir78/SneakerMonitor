const BaseScraper = require('./base-scraper');

class AlufSportScraper extends BaseScraper {
    constructor(searchTerm) {
        const query = searchTerm;
        if (!query) throw new Error("Search term is required for AlufSportScraper");
        super('Aluf Sport', `https://www.alufsport.co.il/?s=${encodeURIComponent(query)}&post_type=product`);
    }

    async parse(page) {
        try {
            await page.waitForSelector('ul.products, .products, .product-grid-item', { timeout: 15000 });
        } catch (e) {
            return [];
        }

        return await page.evaluate(() => {
            const items = [];
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
                        items.push({ title, price, link, store: 'Aluf Sport', sizes: [] });
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

module.exports = AlufSportScraper;
