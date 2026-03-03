const DOMNavigator = require('./DOMNavigator');

class MayersAgent extends DOMNavigator {
    constructor() {
        super('Mayers', 'https://www.mayers.co.il');
    }

    async scrape(brand, model) {
        // Normalize model: insert space before version suffix (990v6 → 990 v6) for WooCommerce search
        const normalizedModel = model.replace(/(\d+)(v\d+)/gi, '$1 $2');
        const query = encodeURIComponent(normalizedModel);
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
                    const pdpProduct = await this._scrapePDP(this.page, finalUrl);
                    return resolve(pdpProduct ? [pdpProduct] : []);
                }

                // Wait for any product grid – broad selectors to handle different page themes
                try {
                    await this.page.waitForSelector(
                        'ul.products li.product, .products-grid .product, .wd-products .product-grid-item, li.product',
                        { timeout: 10000 }
                    );
                } catch (e) {
                    console.log('[Mayers] No search grid found.');
                }

                // Extract product URLs from the grid
                const productLinks = await this.page.evaluate(() => {
                    const seen = new Set();
                    const results = [];
                    const tiles = document.querySelectorAll(
                        'ul.products li.product, .products-grid .product, ' +
                        '.wd-products .product-grid-item, li.product'
                    );
                    tiles.forEach(tile => {
                        if (tile.closest('.wd-carousel-container')) return;
                        const a = tile.querySelector('a[href*="/p/"], a[href*="/product/"], a.woocommerce-LoopProduct-link, a');
                        const href = a?.href || '';
                        if (!href || seen.has(href)) return;
                        seen.add(href);

                        const titleEl = tile.querySelector('.product-title a, h3.wd-entities-title a, h3, h2, .name');
                        const title = titleEl?.getAttribute('aria-label') || titleEl?.innerText?.trim() || a?.getAttribute('aria-label') || '';
                        const imgEl = tile.querySelector('img');
                        const priceEl = tile.querySelector('.price .amount, .woocommerce-Price-amount');
                        const price = parseFloat((priceEl?.innerText || '').replace(/[^\d.]/g, '')) || 0;

                        results.push({ href, title, price, image: imgEl?.src || imgEl?.getAttribute('data-src') || '' });
                    });
                    return results;
                });

                console.log(`[Mayers] Found ${productLinks.length} product links. Fetching sizes from PDPs...`);

                // Fetch sizes sequentially from each PDP
                const finalProducts = [];
                for (const link of productLinks.slice(0, 10)) {
                    try {
                        await this.page.goto(link.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
                        await new Promise(r => setTimeout(r, 1500));
                        const pdp = await this._scrapePDP(this.page, link.href);
                        if (pdp) {
                            if (!pdp.raw_title && link.title) pdp.raw_title = link.title;
                            if (!pdp.raw_price && link.price) pdp.raw_price = link.price;
                            if (!pdp.raw_image_url && link.image) pdp.raw_image_url = link.image;
                            finalProducts.push(pdp);
                        }
                    } catch (e) {
                        console.log(`[Mayers] Failed to fetch PDP: ${link.href} – ${e.message}`);
                    }
                }

                console.log(`[Mayers] Found ${finalProducts.length} products`);
                resolve(finalProducts);
            } catch (err) {
                console.error(`[Mayers] Scrape error: ${err.message}`);
                resolve([]);
            }
        });
    }

    /** Extract product data + sizes from a WooCommerce PDP */
    async _scrapePDP(page, url) {
        try {
            await page.waitForSelector('.product_title, h1.entry-title', { timeout: 8000 }).catch(() => { });
            await new Promise(r => setTimeout(r, 1000));

            return await page.evaluate((pageUrl) => {
                const titleEl = document.querySelector('h1.product_title, .product_title, h1.entry-title');
                if (!titleEl) return null;
                const title = titleEl.innerText.trim();

                // Price – try multiple selectors
                const priceSelectors = [
                    '.price ins .woocommerce-Price-amount bdi',
                    '.price ins .woocommerce-Price-amount',
                    '.woocommerce-variation-price .woocommerce-Price-amount bdi',
                    '.price .woocommerce-Price-amount bdi',
                    '.price .woocommerce-Price-amount',
                    '.summary .price bdi',
                ];
                let price = 0;
                for (const sel of priceSelectors) {
                    const el = document.querySelector(sel);
                    if (el) {
                        const parsed = parseFloat(el.innerText.replace(/[^\d.]/g, ''));
                        if (parsed > 50) { price = parsed; break; }
                    }
                }
                if (price === 0) {
                    const m = (document.querySelector('.summary')?.innerText || '').match(/(\d{3,5})(?:\.\d{0,2})?\s*(?:₪|ILS)/);
                    if (m) price = parseFloat(m[1]);
                }

                // Sizes — visual swatches first, then <select> fallback
                const raw_sizes = [];

                // Strategy 1: swatch/button items
                document.querySelectorAll(
                    '.variable-items-wrapper .variable-item:not(.disabled):not(.out-of-stock) .variable-item-span, ' +
                    '.wc-swatches-wrap .swatch:not(.disabled):not(.outofstock), ' +
                    '.variations .wd-swatches-ul li:not(.disabled):not(.wd-size-out-of-stock)'
                ).forEach(el => {
                    const v = (el.innerText || el.getAttribute('data-value') || '').replace(/^(EU|US|UK)\s*/i, '').trim();
                    if (v && /\d/.test(v) && !raw_sizes.includes(v)) raw_sizes.push(v);
                });

                // Strategy 2: <select> options (the Lime Shoes / Mayers style)
                if (raw_sizes.length === 0) {
                    document.querySelectorAll('.variations select option:not([disabled]):not([value=""])').forEach(o => {
                        const v = (o.textContent || '').replace(/^(EU|US|UK)\s*/i, '').trim();
                        if (v && /\d/.test(v) && !raw_sizes.includes(v)) raw_sizes.push(v);
                    });
                }

                const imgEl = document.querySelector('.woocommerce-product-gallery__image img, .wp-post-image');
                return { raw_title: title, raw_price: price, raw_url: pageUrl, raw_image_url: imgEl?.src || '', raw_sizes };
            }, url);
        } catch (e) {
            return null;
        }
    }
}

module.exports = MayersAgent;
