const DOMNavigator = require('./DOMNavigator');

class MayersAgent extends DOMNavigator {
    constructor() {
        super('Mayers', 'https://www.mayers.co.il');
    }

    async scrape(brand, model) {
        const query = encodeURIComponent(model);
        const searchUrl = `${this.targetUrl}/?s=${query}&post_type=product`;

        return new Promise(async (resolve) => {
            try {
                console.log(`[Mayers] Navigating to: ${searchUrl}`);
                await this.navigateWithRetry(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await new Promise(r => setTimeout(r, 2000));

                // Detect if WooCommerce auto-redirected to a single product page (URL contains /p/)
                const finalUrl = this.page.url();
                const isProductPage = finalUrl.includes('/p/') || finalUrl.includes('/product/');

                if (isProductPage) {
                    console.log(`[Mayers] Auto-redirected to PDP: ${finalUrl}`);
                    // Wait for WooCommerce to finish rendering the price (variable products use JS to set price)
                    try { await this.page.waitForSelector('.price .woocommerce-Price-amount, .woocommerce-Price-amount', { timeout: 8000 }); } catch (e) { }
                    await new Promise(r => setTimeout(r, 1500));

                    // Extract directly from the product detail page
                    const pdpProduct = await this.page.evaluate(() => {
                        const titleEl = document.querySelector('h1.product_title, .product_title');
                        if (!titleEl) return null;
                        const title = titleEl.innerText.trim();

                        // Try multiple price selectors in order of preference
                        const priceSelectors = [
                            '.price ins .woocommerce-Price-amount bdi',
                            '.price ins .woocommerce-Price-amount',
                            '.woocommerce-variation-price .woocommerce-Price-amount bdi',
                            '.woocommerce-variation-price .woocommerce-Price-amount',
                            '.price .woocommerce-Price-amount bdi',
                            '.price .woocommerce-Price-amount',
                            '.summary .price bdi',
                        ];
                        let price = 0;
                        for (const sel of priceSelectors) {
                            const el = document.querySelector(sel);
                            if (el) {
                                const raw = el.innerText.replace(/[^\d.]/g, '');
                                const parsed = parseFloat(raw);
                                if (parsed > 50) { price = parsed; break; }
                            }
                        }
                        // Last resort: scan .summary text for price pattern "NNN ₪"
                        if (price === 0) {
                            const bodyText = document.querySelector('.summary')?.innerText || document.body.innerText;
                            const m = bodyText.match(/(\d{3,5})(?:\.\d{0,2})?\s*(?:₪|ILS)/);
                            if (m) price = parseFloat(m[1]);
                        }

                        const imgEl = document.querySelector('.woocommerce-product-gallery__image img, .wp-post-image');
                        const sizeEls = document.querySelectorAll(
                            '.variable-items-wrapper .variable-item:not(.disabled):not(.out-of-stock) .variable-item-span, ' +
                            '.woocommerce-variation-add-to-cart select option:not([value=""]):not([disabled])'
                        );
                        const raw_sizes = [...sizeEls].map(el => (el.innerText || el.value).trim()).filter(Boolean);
                        return { raw_title: title, raw_price: price, raw_url: window.location.href, raw_image_url: imgEl?.src || '', raw_sizes };
                    });

                    if (pdpProduct) {
                        console.log(`[Mayers] PDP product found: ${pdpProduct.raw_title}`);
                        return resolve([pdpProduct]);
                    }
                    return resolve([]);
                }

                // Search result grid – target ONLY the primary wd-grid, ignoring carousels
                try {
                    await this.page.waitForSelector('.wd-products.wd-grid-g .product-grid-item, .products.wd-grid-g', { timeout: 10000 });
                } catch (e) {
                    console.log('[Mayers] No search grid found.');
                }

                const products = await this.page.evaluate(() => {
                    const results = [];
                    // Use the scoped selector to EXCLUDE carousel/recommendation sections
                    const tiles = document.querySelectorAll(
                        '.wd-products.wd-grid-g .product-grid-item, ' +
                        '.products.wd-grid-g .product-grid-item'
                    );

                    tiles.forEach(tile => {
                        // Bail out if this tile is inside a carousel
                        if (tile.closest('.wd-carousel-container')) return;

                        const titleEl = tile.querySelector('.product-image-link, h3.wd-entities-title a, .product-title a');
                        const priceEl = tile.querySelector('.price .amount, .woocommerce-Price-amount');
                        const linkEl = tile.querySelector('a.product-image-link, a[href*="/p/"]') || tile.querySelector('a');
                        const imgEl = tile.querySelector('img.attachment-woocommerce_thumbnail, img');

                        const title = titleEl?.getAttribute('aria-label') || titleEl?.innerText?.trim() || '';
                        if (!title) return;

                        let price = 0;
                        if (priceEl) {
                            const newPriceEl = priceEl.querySelector('ins .amount') || priceEl;
                            price = parseFloat(newPriceEl.innerText.replace(/[^\d.]/g, '')) || 0;
                        }

                        results.push({
                            raw_title: title,
                            raw_price: price,
                            raw_url: linkEl?.href || '',
                            raw_image_url: imgEl?.src || imgEl?.getAttribute('data-src') || ''
                        });
                    });
                    return results;
                });

                console.log(`[Mayers] Found ${products.length} products`);
                resolve(products);
            } catch (err) {
                console.error(`[Mayers] Scrape error: ${err.message}`);
                resolve([]);
            }
        });
    }
}

module.exports = MayersAgent;
