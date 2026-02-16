const BaseScraper = require('./base-scraper');

class Arba4Scraper extends BaseScraper {
    constructor(searchInput) {
        super(searchInput, 'Arba4');
        this.baseUrl = 'https://arba4.co.il/';
        this.searchUrl = (query) => `https://arba4.co.il/?s=${encodeURIComponent(query)}&post_type=product`;
    }

    async scrape(browser, targetModels, targetSizes) {
        return super.scrape(browser, targetModels, targetSizes);
    }

    async scrapePage(page, url, targetModels, targetSizes) {
        console.log(`[${this.storeName}] Navigating to: ${url}`);

        await page.goto(url, { waitUntil: 'load', timeout: 60000 });

        try {
            await page.waitForSelector('ul.products, .products', { timeout: 15000 });
        } catch (e) {
            console.log(`[${this.storeName}] No products container found or timeout. Possibly 0 results.`);
            return [];
        }

        const products = await page.evaluate(() => {
            const items = [];
            const elements = document.querySelectorAll('li.product, .product-grid-item');

            elements.forEach(el => {
                try {
                    let titleEl = el.querySelector('.woocommerce-loop-product__title, .product-title, h3, h2');
                    let title = titleEl ? titleEl.innerText.trim() : '';

                    if (!title) return;

                    const priceEls = el.querySelectorAll('.price bdi');
                    let priceText = '';

                    if (priceEls.length > 0) {
                        priceText = priceEls[priceEls.length - 1].innerText;
                    } else {
                        const priceEl = el.querySelector('.price');
                        priceText = priceEl ? priceEl.innerText : '';
                    }

                    const price = parseFloat(priceText.replace(/[^\d.]/g, ''));

                    const linkEl = el.querySelector('a.woocommerce-LoopProduct-link, a.product-link');
                    const link = linkEl ? linkEl.href : '';

                    const imgEl = el.querySelector('img.attachment-woocommerce_thumbnail, img.wp-post-image');
                    const image = imgEl ? (imgEl.getAttribute('data-src') || imgEl.src) : '';

                    const isOutOfStock = el.classList.contains('outofstock') ||
                        (el.innerText && el.innerText.includes('אזל במלאי'));

                    if (title && price && !isNaN(price) && !isOutOfStock) {
                        items.push({ title, price, link, image, store: 'Arba4' });
                    }
                } catch (err) {
                    // ignore
                }
            });
            return items;
        });

        console.log(`[${this.storeName}] Raw items found: ${products.length}`);
        return products;
    }
}

module.exports = Arba4Scraper;
