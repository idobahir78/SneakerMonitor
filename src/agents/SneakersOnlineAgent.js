const DOMNavigator = require('./DOMNavigator');

class SneakersOnlineAgent extends DOMNavigator {
    constructor() {
        super('Sneakers Online', 'https://sneakersonline.co.il');
    }

    async scrape(brand, model) {
        const query = encodeURIComponent(`${brand} ${model}`);
        // Standard WooCommerce search URL
        const searchUrl = `${this.targetUrl}/?s=${query}&post_type=product`;

        return new Promise(async (resolve) => {
            try {
                console.log(`[Sneakers Online] Navigating to: ${searchUrl}`);
                await this.navigateWithRetry(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await new Promise(r => setTimeout(r, 4000));

                try {
                    await this.page.waitForSelector('.product', { timeout: 10000 });
                } catch (e) {
                    // No products found is handled below
                }

                // Step 1: Collect product links and basic info from grid
                const gridProducts = await this.page.evaluate(() => {
                    const results = [];
                    // WooCommerce uses .product for grid items
                    document.querySelectorAll('.product').forEach(el => {
                        // Title
                        const titleEl = el.querySelector('.woocommerce-loop-product__title, .wd-entities-title, .product-title');
                        const title = titleEl ? titleEl.innerText.trim() : '';

                        // Link
                        const linkEl = el.querySelector('a');
                        const link = linkEl ? linkEl.href : '';

                        // Price
                        const priceEl = el.querySelector('.price');
                        let price = 0;
                        if (priceEl) {
                            // Extract numbers from "₪ 569.00"
                            const priceText = priceEl.innerText || '';
                            const priceMatch = priceText.match(/₪\s*(\d+[.,]?\d*)/);
                            if (priceMatch) {
                                price = parseFloat(priceMatch[1].replace(',', ''));
                            }
                        }

                        // Image
                        const imgEl = el.querySelector('img');
                        const imgUrl = imgEl?.src || imgEl?.getAttribute('data-src') || '';

                        // Stock Badge check (Skip Out Of Stock)
                        const isOutOfStock = el.querySelector('.out-of-stock') !== null;

                        if (title && link && !isOutOfStock) {
                            results.push({
                                raw_title: title,
                                raw_price: price,
                                raw_url: link,
                                raw_image_url: imgUrl
                            });
                        }
                    });
                    return results;
                });

                console.log(`[Sneakers Online] Found ${gridProducts.length} product links. Fetching sizes from PDPs...`);

                const finalProducts = [];
                // Process top 12 products to avoid excessive scraping
                for (const item of gridProducts.slice(0, 12)) {
                    if (!item.raw_url) continue;

                    try {
                        await this.page.goto(item.raw_url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                        await new Promise(r => setTimeout(r, 3000));

                        const raw_sizes = await this.page.evaluate(() => {
                            const sizes = [];

                            // Method 1: Variation swatches (div/span/li with data-value)
                            const swatches = document.querySelectorAll('.variable-item:not(.disabled):not(.out-of-stock), .swatch:not(.disabled):not(.out-of-stock), [data-value]');
                            swatches.forEach(el => {
                                const val = el.getAttribute('data-value') || el.innerText;
                                // Ignore random garbage strings like "{"count":0...}"
                                if (val && val.match(/^[0-9A-Za-z.\-\s]+$/) && !val.includes('count')) {
                                    sizes.push(val.trim());
                                }
                            });

                            // Method 2: Standard WooCommerce selects
                            if (sizes.length === 0) {
                                const select = document.querySelector('select[name^=\"attribute\"]');
                                if (select) {
                                    Array.from(select.options).forEach(opt => {
                                        if (opt.value && !opt.disabled && !opt.text.includes('בחר')) {
                                            sizes.push(opt.text.trim());
                                        }
                                    });
                                }
                            }

                            return Array.from(new Set(sizes)); // Remove duplicates
                        });

                        console.log(`[Sneakers Online] "${item.raw_title}" → Sizes: [${raw_sizes.join(', ')}]`);
                        finalProducts.push({ ...item, raw_sizes });
                    } catch (e) {
                        console.error(`[Sneakers Online] Error fetching PDP ${item.raw_url}: ${e.message}`);
                        finalProducts.push({ ...item, raw_sizes: [] });
                    }
                }

                resolve(finalProducts);
            } catch (err) {
                console.error(`[Sneakers Online] Scrape error: ${err.message}`);
                resolve([]);
            }
        });
    }
}

module.exports = SneakersOnlineAgent;
