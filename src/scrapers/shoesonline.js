const BaseScraper = require('./base-scraper');

class ShoesOnlineScraper extends BaseScraper {
    constructor(searchInput) {
        super(searchInput, 'Shoesonline');
        this.baseUrl = 'https://shoesonline.co.il/';
        // Standard WooCommerce search URL
        this.searchUrl = (query) => `https://shoesonline.co.il/?s=${encodeURIComponent(query)}&post_type=product`;
    }

    async scrape(browser, targetModels, targetSizes) {
        return super.scrape(browser, targetModels, targetSizes);
    }

    async scrapePage(page, url, targetModels, targetSizes) {
        console.log(`[${this.storeName}] Navigating to: ${url}`);

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Wait for product list (WooCommerce standard)
        // Try multiple selectors just in case custom theme
        try {
            await page.waitForSelector('ul.products, .products', { timeout: 10000 });
        } catch (e) {
            console.log(`[${this.storeName}] No products container found or timeout. Possibly 0 results.`);
            return [];
        }

        const products = await page.evaluate(() => {
            const items = [];
            // Select all product items
            const elements = document.querySelectorAll('li.product, .product-grid-item');

            elements.forEach(el => {
                try {
                    // Title
                    // Try standard WC title
                    let titleEl = el.querySelector('.woocommerce-loop-product__title, .product-title, h3, h2');
                    let title = titleEl ? titleEl.innerText.trim() : '';

                    // If no title, skip
                    if (!title) return;

                    // Price
                    // WC prices: <span class="price"><del>...</del> <ins>...</ins></span>
                    // We want the lowest active price.
                    // Look for <bdi> tag inside .price which usually holds the number
                    const priceEls = el.querySelectorAll('.price bdi');
                    let priceText = '';

                    if (priceEls.length > 0) {
                        // If multiple prices (sale), usually the last one is the sale price
                        priceText = priceEls[priceEls.length - 1].innerText;
                    } else {
                        // Fallback
                        const priceEl = el.querySelector('.price');
                        priceText = priceEl ? priceEl.innerText : '';
                    }

                    // Clean price
                    const price = parseFloat(priceText.replace(/[^\d.]/g, ''));

                    // Link
                    const linkEl = el.querySelector('a.woocommerce-LoopProduct-link, a.product-link');
                    const link = linkEl ? linkEl.href : '';

                    // Image
                    const imgEl = el.querySelector('img.attachment-woocommerce_thumbnail, img.wp-post-image');
                    const image = imgEl ? (imgEl.getAttribute('data-src') || imgEl.src) : '';

                    // Availability
                    // Check for "Out of Stock" badge or class
                    const isOutOfStock = el.classList.contains('outofstock') ||
                        (el.innerText && el.innerText.includes('אזל במלאי'));

                    if (title && price && !isNaN(price) && !isOutOfStock) {
                        items.push({ title, price, link, image, store: 'Shoesonline' });
                    }
                } catch (err) {
                    // Ignore individual item errors
                }
            });
            return items;
        });

        console.log(`[${this.storeName}] Raw items found: ${products.length}`);
        return products;
    }
}

module.exports = ShoesOnlineScraper;
