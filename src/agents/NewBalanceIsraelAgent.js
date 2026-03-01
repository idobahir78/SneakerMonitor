const DOMNavigator = require('./DOMNavigator');

class NewBalanceIsraelAgent extends DOMNavigator {
    constructor() {
        super('New Balance IL', 'https://www.newbalance.co.il');
    }

    async scrape(brand, model) {
        if (brand.toLowerCase() !== 'new balance') return [];
        const query = encodeURIComponent(model);
        // Correct NB Israel SFCC search URL (browser research confirmed)
        const searchUrl = `${this.targetUrl}/he/search?q=${query}`;

        return new Promise(async (resolve) => {
            try {
                console.log(`[New Balance IL] Navigating to: ${searchUrl}`);
                await this.navigateWithRetry(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                // SFCC pages need extra time for React/JS hydration of the product grid
                await new Promise(r => setTimeout(r, 5000));

                try {
                    await this.page.waitForSelector('.product-tile-item, .product-tile, .grid-tile', { timeout: 10000 });
                } catch (e) { }

                const products = await this.page.evaluate(() => {
                    const results = [];
                    // Confirmed selector from browser research
                    const tiles = document.querySelectorAll('.product-tile-item, .product-tile');

                    tiles.forEach(tile => {
                        const titleEl = tile.querySelector('.product-tile__name, .product-name, .pdp-link a');
                        const priceEl = tile.querySelector('.sales .value, .price-sales .value, .price .value');
                        const linkEl = tile.querySelector('a.tile-image-link, a.thumb-link') || tile.querySelector('a');
                        const imgEl = tile.querySelector('img.tile-image, img');

                        const title = titleEl?.innerText?.trim() || '';
                        if (!title) return;

                        let price = 0;
                        if (priceEl) {
                            const raw = priceEl.getAttribute('content') || priceEl.innerText || '0';
                            const m = raw.match(/(\d{2,5}\.?\d{0,2})/);
                            price = m ? parseFloat(m[1]) : 0;
                        }

                        // Collect available sizes from swatches (disabled = out of stock)
                        const raw_sizes = [...tile.querySelectorAll('.swatchable-radio:not(.disabled) input')]
                            .map(inp => (inp.value || inp.getAttribute('data-value') || '').trim())
                            .filter(Boolean);

                        results.push({
                            raw_title: title,
                            raw_price: price,
                            raw_url: linkEl?.href || '',
                            raw_image_url: imgEl?.src || imgEl?.getAttribute('data-src') || '',
                            raw_sizes
                        });
                    });
                    return results;
                });

                console.log(`[New Balance IL] Found ${products.length} products`);
                resolve(products);
            } catch (err) {
                console.error(`[New Balance IL] Scrape error: ${err.message}`);
                resolve([]);
            }
        });
    }
}

module.exports = NewBalanceIsraelAgent;
