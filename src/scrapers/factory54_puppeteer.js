const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

class Factory54PuppeteerScraper {
    constructor(query) {
        this.query = query;
        this.storeName = 'Factory 54';
        this.baseUrl = 'https://www.factory54.co.il';
        this.searchUrl = `${this.baseUrl}/search?q=${encodeURIComponent(query)}`;
    }

    async scrape(browser) {
        console.log(`[Factory54] Launching for query: ${this.query}`);
        let page;

        try {
            page = await browser.newPage();
            // Optional: Set viewport if needed, though monitor.js might not set it per page
            await page.setViewport({ width: 1920, height: 1080 });

            console.log(`[Factory54] Navigating to ${this.searchUrl}...`);
            await page.goto(this.searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });

            // Wait for products
            try {
                await page.waitForSelector('div[data-gtm-product]', { timeout: 15000 });
            } catch (e) {
                console.log("[Factory54] Warning: 'div[data-gtm-product]' not found immediately. Waiting extra time...");
                await new Promise(r => setTimeout(r, 5000));
            }

            // Check for "No Results"
            const noResults = await page.evaluate(() => {
                return document.body.innerText.includes('0 תוצאות') || document.body.innerText.includes('לא נמצאו');
            });

            if (noResults) {
                console.log("[Factory54] No results found on page.");
                return [];
            }

            // Extract Data
            const products = await page.evaluate(() => {
                const results = [];
                const items = document.querySelectorAll('div[data-gtm-product]');

                items.forEach(item => {
                    try {
                        const jsonStr = item.getAttribute('data-gtm-product');
                        let meta = {};
                        if (jsonStr) {
                            try { meta = JSON.parse(jsonStr); } catch (e) { }
                        }

                        const linkTag = item.querySelector('a') || item.closest('a');
                        const href = linkTag ? linkTag.href : '';

                        let image = '';
                        const imgContainer = item.querySelector('.image-container');
                        if (imgContainer && imgContainer.getAttribute('data-hover-image-url')) {
                            image = imgContainer.getAttribute('data-hover-image-url');
                        } else {
                            const imgTag = item.querySelector('img');
                            if (imgTag) image = imgTag.src || imgTag.getAttribute('data-src');
                        }

                        let title = meta.item_name;
                        let price = meta.price;
                        let brand = meta.item_brand;

                        if (!title) {
                            const titleEl = item.querySelector('.tile-body__product-name');
                            if (titleEl) title = titleEl.innerText.trim();
                        }

                        results.push({
                            title: title || 'N/A',
                            price: price || 0,
                            store: 'Factory 54', // Standardized field name
                            link: href,
                            image: image,
                            brand: brand || 'N/A'
                        });

                    } catch (err) { }
                });
                return results;
            });

            console.log(`[Factory54] Scraped ${products.length} products.`);
            return products;

        } catch (e) {
            console.error("[Factory54] Error:", e.message);
            return [];
        } finally {
            if (page) await page.close();
        }
    }
}

module.exports = Factory54PuppeteerScraper;
