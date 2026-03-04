const DOMNavigator = require('./DOMNavigator');

class SportLibermanAgent extends DOMNavigator {
    constructor() {
        super('Sport Liberman', 'https://www.sportliberman.co.il');
    }

    async scrape(brand, model) {
        const query = encodeURIComponent(`${brand} ${model}`);
        // CashCow default search URL format
        const searchUrl = `${this.targetUrl}/?s=${query}&post_type=product`;

        return new Promise(async (resolve) => {
            try {
                console.log(`[Sport Liberman] Navigating to: ${searchUrl}`);
                await this.navigateWithRetry(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                // Let the CashCow platform load products (sometimes loaded via AJAX)
                await new Promise(r => setTimeout(r, 4000));

                try {
                    await this.page.waitForSelector('.product, .cc-product', { timeout: 10000 });
                } catch (e) { }

                // Step 1: Collect product links and basic info from grid
                const gridProducts = await this.page.evaluate(() => {
                    const results = [];
                    // CashCow typically uses .product or .cc-product for grid items
                    document.querySelectorAll('.product, .cc-product').forEach(el => {
                        const title = el.getAttribute('data-name') || el.querySelector('.cc-prod-name')?.innerText || '';

                        // Price handling: in CashCow it's usually inside .cc-price
                        const priceText = el.querySelector('.cc-price') ? el.querySelector('.cc-price').innerText : '';
                        const priceMatch = priceText.match(/(\d{2,5})/);
                        const price = priceMatch ? parseFloat(priceMatch[1]) : 0;

                        // Link handling: data-permalink or standard <a>
                        let link = el.querySelector('a')?.href || '';
                        const permalink = el.getAttribute('data-permalink');
                        if (!link && permalink) {
                            link = `https://www.sportliberman.co.il/p/${permalink}`;
                        }

                        // Image handling
                        const imgEl = el.querySelector('img');
                        const imgUrl = imgEl?.src || imgEl?.getAttribute('data-src') || '';

                        if (title && link) {
                            results.push({
                                raw_title: title.trim(),
                                raw_price: price,
                                raw_url: link,
                                raw_image_url: imgUrl
                            });
                        }
                    });
                    return results;
                });

                console.log(`[Sport Liberman] Found ${gridProducts.length} product links. Fetching sizes from PDPs...`);

                const finalProducts = [];
                // Process top 12 products to avoid excessive scraping
                for (const item of gridProducts.slice(0, 12)) {
                    if (!item.raw_url) continue;

                    try {
                        await this.page.goto(item.raw_url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                        await new Promise(r => setTimeout(r, 3000));

                        const raw_sizes = await this.page.evaluate(() => {
                            const sizes = [];
                            // Look for select dropdowns (very common in CashCow)
                            const select = document.querySelector('select[name*="option"], select');
                            if (select) {
                                Array.from(select.options).forEach(opt => {
                                    // Skip placeholder options like "בחירה" or "Choose"
                                    if (opt.value && !opt.disabled && !opt.text.includes('בחירה')) {
                                        sizes.push(opt.text.trim());
                                    }
                                });
                            } else {
                                // Fallback to radio labels / variation labels if no select exists
                                const labels = document.querySelectorAll('.cc-variations label, .swatch-label, .variation-label');
                                labels.forEach(l => {
                                    if (!l.classList.contains('disabled') && !l.classList.contains('out-of-stock')) {
                                        sizes.push(l.innerText.trim());
                                    }
                                });
                            }
                            return sizes;
                        });

                        console.log(`[Sport Liberman] "${item.raw_title}" → Sizes: [${raw_sizes.join(', ')}]`);
                        finalProducts.push({ ...item, raw_sizes });
                    } catch (e) {
                        console.error(`[Sport Liberman] Error fetching PDP ${item.raw_url}: ${e.message}`);
                        finalProducts.push({ ...item, raw_sizes: [] });
                    }
                }

                resolve(finalProducts);
            } catch (err) {
                console.error(`[Sport Liberman] Scrape error: ${err.message}`);
                resolve([]);
            }
        });
    }
}

module.exports = SportLibermanAgent;
