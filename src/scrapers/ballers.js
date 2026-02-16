const BaseScraper = require('./base-scraper');

class BallersScraper extends BaseScraper {
    constructor(searchTerm) {
        const query = searchTerm;
        if (!query) throw new Error("Search term is required for BallersScraper");
        super('Ballers', `https://ballers.co.il/?s=${encodeURIComponent(query)}&post_type=product`);
    }

    async navigate(page) {
        let retries = 2;
        while (retries > 0) {
            try {
                await page.goto(this.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
                return; // Success
            } catch (e) {
                console.log(`[Ballers] Navigation failed (\${e.message}). Retrying... (\${retries} attempts left)`);
                retries--;
                if (retries === 0) throw e;
                await new Promise(r => setTimeout(r, 2000));
            }
        }
    }

    async parse(page) {
        // Wait for results or no results
        try {
            await Promise.race([
                page.waitForSelector('.product', { timeout: 15000 }),
                page.waitForFunction(() => document.body.innerText.includes('לא נמצאו') || document.body.innerText.includes('No products found'), { timeout: 15000 })
            ]);
        } catch (e) {
            console.log(`[${this.storeName}] Wait for results timed out.`);
        }

        return await page.evaluate(() => {
            const results = [];
            const items = document.querySelectorAll('.product');

            items.forEach((item, index) => {
                const titleEl = item.querySelector('h2, h3, .product-title, .woocommerce-loop-product__title');
                const linkEl = item.querySelector('a');
                const priceEl = item.querySelector('.price');
                const imgEl = item.querySelector('img');

                if (titleEl && linkEl) {
                    const title = titleEl.innerText.trim();
                    const link = linkEl.href;
                    let price = 0;
                    if (priceEl) {
                        const priceText = priceEl.innerText;
                        const numbers = priceText.match(/[0-9.]+/g);
                        if (numbers && numbers.length > 0) {
                            price = Math.min(...numbers.map(n => parseFloat(n)));
                        }
                    }

                    results.push({
                        index,
                        title,
                        price,
                        link,
                        image: imgEl ? imgEl.src : '',
                        store: 'Ballers'
                    });
                }
            });
            return results;
        });
    }

    async parseSizes(page) {
        return await page.evaluate(() => {
            const sizes = [];
            // Ballers likely uses standard woo/shopify selectors
            const sizeEls = document.querySelectorAll('.swatch-element:not(.soldout) label, .variable-item:not(.disabled)');

            sizeEls.forEach(el => sizes.push(el.innerText.trim()));

            if (sizes.length === 0) {
                // Try dropdown
                const options = document.querySelectorAll('select[id*="size"] option, select[name*="attribute_pa_size"] option');
                options.forEach(opt => {
                    if (!opt.disabled && opt.value && opt.innerText.match(/[0-9]/)) {
                        sizes.push(opt.innerText.trim());
                    }
                });
            }
            return sizes;
        });
    }
}

module.exports = BallersScraper;
