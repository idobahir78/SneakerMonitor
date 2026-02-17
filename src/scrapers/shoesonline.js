const BaseScraper = require('./base-scraper');

class ShoesOnlineScraper extends BaseScraper {
    constructor(searchTerm) {
        const query = searchTerm;
        if (!query) throw new Error("Search term is required for ShoesOnlineScraper");
        super('Shoesonline', `https://shoesonline.co.il/?s=${encodeURIComponent(query)}&post_type=product`);
    }

    async parse(page) {
        // Wait for results
        try {
            await page.waitForSelector('.product, .type-product', { timeout: 10000 });
        } catch (e) {
            console.log('ShoesOnline: Selector not found (timeout), checking for other layouts...');
        }

        return await page.evaluate(() => {
            const results = [];

            // 1. PDP Handling (Direct Product Page)
            if (document.body.classList.contains('single-product')) {
                const titleEl = document.querySelector('.product_title.entry-title');
                const priceEl = document.querySelector('p.price');
                const imageEl = document.querySelector('.woocommerce-product-gallery__image img');

                if (titleEl) {
                    const title = titleEl.innerText.trim();
                    const link = window.location.href;
                    let price = 0;
                    if (priceEl) {
                        const priceText = priceEl.innerText;
                        const numbers = priceText.replace(/[^\d.]/g, '').match(/[0-9.]+/g);
                        if (numbers && numbers.length > 0) price = parseFloat(numbers[0]);
                    }

                    results.push({
                        store: 'Shoesonline',
                        title,
                        price,
                        priceText: priceEl ? priceEl.innerText.trim() : '',
                        link,
                        image: imageEl ? imageEl.src : null,
                        sizes: []
                    });
                    return results;
                }
            }

            // 2. Search Results / Product Archive
            const items = document.querySelectorAll('.product, .type-product, li.product, .product-grid-item');

            items.forEach(item => {
                const titleEl = item.querySelector('.woocommerce-loop-product__title, .product-title, .name, .model-name, h3, h2');
                const linkEl = item.querySelector('a.woocommerce-LoopProduct-link, a.product-link, a');
                const imgEl = item.querySelector('img.wp-post-image, img');

                // Fix: Select sale price first (ins), otherwise default
                const salePriceEl = item.querySelector('ins .amount');
                const regularPriceEl = item.querySelector('.price');

                let priceText = '';
                if (salePriceEl) {
                    priceText = salePriceEl.innerText;
                } else if (regularPriceEl) {
                    // split by newline in case of multiple prices without tags
                    const raw = regularPriceEl.innerText.trim();
                    const parts = raw.split(/\n/);
                    // usually the last one is the current price if multiple
                    priceText = parts.length > 0 ? parts[parts.length - 1] : raw;
                }

                // Remove non-numeric (keep dot)
                const price = parseFloat(priceText.replace(/[^\d.]/g, ''));

                if (price > 0) {
                    const title = titleEl.innerText.trim();
                    let link = linkEl ? linkEl.href : '';
                    const image = imgEl ? (imgEl.dataset.src || imgEl.src) : null;

                    // Check out of stock
                    const isOutOfStock = item.classList.contains('outofstock') ||
                        (item.innerText && item.innerText.includes('אזל במלאי'));

                    if (!isOutOfStock) {
                        results.push({
                            store: 'Shoesonline',
                            title: title,
                            price: price,
                            priceText: priceText.trim(),
                            link: link,
                            image: image,
                            brand: 'N/A'
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
            const sizeEls = document.querySelectorAll('.variable-items-wrapper .variable-item:not(.disabled), .swatch-wrapper .swatch:not(.disabled), .selection-box:not(.disabled)');
            sizeEls.forEach(el => sizes.push(el.innerText.trim()));
            return sizes;
        });
    }
}

module.exports = ShoesOnlineScraper;
