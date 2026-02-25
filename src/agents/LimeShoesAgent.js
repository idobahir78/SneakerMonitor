const DOMNavigator = require('./DOMNavigator');

class LimeShoesAgent extends DOMNavigator {
    constructor() {
        super('Lime Shoes', 'https://limeshoes.co.il');
    }

    async scrape(brand, model) {
        const searchTerm = `${brand} ${model}`;

        return new Promise(async (resolve, reject) => {
            try {
                // Determine target URL based on legacy WooCommerce fallbacks
                let targetUrl = `${this.targetUrl}/?s=${encodeURIComponent(searchTerm)}&post_type=product`;

                await this.page.setDefaultNavigationTimeout(30000);
                console.log(`[Lime Shoes] Navigating to: ${targetUrl}`);
                await this.page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

                // Optional: Wait for product grid if dynamic
                try {
                    await this.page.waitForSelector('.product, .product-item, li.product', { timeout: 10000 });
                } catch (e) { }

                // Scrape DOM
                const items = await this.page.evaluate(() => {
                    const results = [];
                    const elements = document.querySelectorAll('li.product, .product-grid-item, div.product-item');

                    elements.forEach(el => {
                        const titleEl = el.querySelector('.woocommerce-loop-product__title, .product-title, h3, h2, .name');
                        const priceEls = el.querySelectorAll('.price bdi, .price .amount');
                        const linkEl = el.querySelector('a.woocommerce-LoopProduct-link, a.product-link, a[href*="/product/"]');
                        const imgEl = el.querySelector('img.attachment-woocommerce_thumbnail, img');

                        if (titleEl && linkEl) {
                            const raw_title = titleEl.innerText.trim();
                            let product_url = linkEl.href;
                            if (!product_url) product_url = linkEl.getAttribute('href');
                            let raw_price = 0;
                            let raw_image_url = imgEl ? imgEl.src : '';

                            if (priceEls.length > 0) {
                                // Take the last price element (usually the sale price if multiple exist)
                                const priceText = priceEls[priceEls.length - 1].innerText;
                                const priceMatch = priceText.match(/(\d{2,4}\.?\d{0,2})/);
                                raw_price = priceMatch ? parseFloat(priceMatch[1]) : 0;
                            }

                            // Check for Out of Stock
                            const isOutOfStock = el.classList.contains('outofstock') ||
                                (el.innerText && el.innerText.includes('אזל במלאי'));

                            if (raw_title && raw_price > 0 && !isOutOfStock) {
                                results.push({
                                    raw_title,
                                    raw_price,
                                    product_url,
                                    raw_image_url,
                                    raw_brand: 'Unknown'
                                });
                            }
                        }
                    });
                    return results;
                });

                console.log(`[Lime Shoes] Scraped ${items.length} raw items from DOM.`);
                resolve(items);
            } catch (error) {
                console.error(`[Lime Shoes] Scrape Error:`, error.message);
                resolve([]);
            }
        });
    }
}

module.exports = LimeShoesAgent;
