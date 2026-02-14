const InteractionScraper = require('./interaction-scraper');

class KitsClubScraper extends InteractionScraper {
    constructor(searchTerm) {
        // Use HTML search URL
        const url = `https://thekitsclub7.com/?s=${encodeURIComponent(searchTerm)}&post_type=product`;
        super('Kits Club', url);
        this.searchTerm = searchTerm;
    }

    async navigate(page) {
        // Navigate directly to search results
        await page.goto(this.url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Handle potential popups (standard generic close)
        try {
            const popupClose = await page.$('.elementor-popup-modal .dialog-close-button, .popup-close, #close-popup');
            if (popupClose) {
                console.log(`[${this.storeName}] Closing popup...`);
                await popupClose.click();
            }
        } catch (e) { /* Ignore popup errors */ }
    }

    async parse(page) {
        // Wait for product grid or no results
        try {
            await Promise.race([
                page.waitForSelector('.products .product', { timeout: 15000 }),
                page.waitForFunction(() => document.body.innerText.includes('לא נמצאו') || document.body.innerText.includes('No products found'), { timeout: 15000 })
            ]);
        } catch (e) {
            console.log(`[${this.storeName}] Wait for results timed out (might be 0 results).`);
        }

        return await page.evaluate(() => {
            const items = Array.from(document.querySelectorAll('.products .product'));

            return items.map((item, index) => {
                const titleEl = item.querySelector('.woocommerce-loop-product__title, h2, h3');
                const priceEl = item.querySelector('.price');
                const linkEl = item.querySelector('a');
                // Image selector for WooCommerce
                const imgEl = item.querySelector('img');

                return {
                    index,
                    title: titleEl ? titleEl.innerText.trim() : 'No Title',
                    price: priceEl ? parseFloat(priceEl.innerText.replace(/[^0-9.]/g, '')) : 0,
                    link: linkEl ? linkEl.href : '',
                    image: imgEl ? imgEl.src : '',
                    store: 'Kits Club'
                };
            });
        });
    }
}

module.exports = KitsClubScraper;
