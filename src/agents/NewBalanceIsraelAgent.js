const DOMNavigator = require('./DOMNavigator');

class NewBalanceIsraelAgent extends DOMNavigator {
    constructor() {
        super('New Balance IL', 'https://www.newbalance.co.il');
    }

    async scrape(brand, model) {
        if (brand.toLowerCase() !== 'new balance') return [];
        const query = encodeURIComponent(model);
        // Correct NB Israel SFCC search URL (browser research confirmed)
        const searchUrl = `${this.targetUrl}/he/category?q=${query}`;

        return new Promise(async (resolve) => {
            try {
                console.log(`[New Balance IL] Navigating to: ${searchUrl}`);
                await this.navigateWithRetry(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                // SFCC pages need extra time for React/JS hydration of the product grid
                await new Promise(r => setTimeout(r, 5000));

                try {
                    await this.page.waitForSelector('.product-tile-item, .product-tile, .grid-tile', { timeout: 10000 });
                } catch (e) { }

                // Step 1: Collect product links and basic info from grid
                const gridProducts = await this.page.evaluate(() => {
                    const results = [];
                    const tiles = document.querySelectorAll('.product-tile-item, .product-tile');

                    tiles.forEach(tile => {
                        const titleEl = tile.querySelector('.product-tile__name, .product-name, .pdp-link a, .link');
                        const priceEl = tile.querySelector('.sales .value, .price-sales .value, .price .value');
                        const linkEl = tile.querySelector('a.tile-image-link, a.thumb-link, .pdp-link a') || tile.querySelector('a');
                        const imgEl = tile.querySelector('img.tile-image, img');

                        const title = titleEl?.innerText?.trim() || '';
                        if (!title) return;

                        let price = 0;
                        if (priceEl) {
                            const raw = priceEl.getAttribute('content') || priceEl.innerText || '0';
                            const m = raw.match(/(\d{2,5}\.?\d{0,2})/);
                            price = m ? parseFloat(m[1]) : 0;
                        }

                        results.push({
                            raw_title: title,
                            raw_price: price,
                            raw_url: linkEl?.href || '',
                            raw_image_url: imgEl?.src || imgEl?.getAttribute('data-src') || '',
                        });
                    });
                    return results;
                });

                console.log(`[New Balance IL] Found ${gridProducts.length} products`);

                // Step 2: Visit each PDP to fetch sizes (SFCC category page has no size swatches)
                const finalProducts = [];
                for (const item of gridProducts.slice(0, 12)) {
                    if (!item.raw_url) {
                        finalProducts.push({ ...item, raw_sizes: [] });
                        continue;
                    }
                    try {
                        await this.page.goto(item.raw_url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                        await new Promise(r => setTimeout(r, 2000));

                        const raw_sizes = await this.page.evaluate(() => {
                            const sizes = [];

                            // SFCC size attribute buttons
                            document.querySelectorAll(
                                '.size-btn:not(.unselectable):not(.out-of-stock), ' +
                                '.attribute-values .value-item:not(.unavailable):not(.out-of-stock) span, ' +
                                '.size-select option:not([disabled]):not([value=""]), ' +
                                '.swatchable-radio:not(.disabled) input'
                            ).forEach(el => {
                                const v = (el.textContent || el.value || el.getAttribute('data-value') || '').trim();
                                if (v && /^\d{2}(\.\d)?$/.test(v) && !sizes.includes(v)) sizes.push(v);
                            });

                            return sizes;
                        });

                        console.log(`[New Balance IL PDP] "${item.raw_title}" → Sizes: [${raw_sizes.join(', ')}]`);
                        finalProducts.push({ ...item, raw_sizes });
                    } catch (e) {
                        finalProducts.push({ ...item, raw_sizes: [] });
                    }
                }

                resolve(finalProducts);
            } catch (err) {
                console.error(`[New Balance IL] Scrape error: ${err.message}`);
                resolve([]);
            }
        });
    }
}

module.exports = NewBalanceIsraelAgent;
