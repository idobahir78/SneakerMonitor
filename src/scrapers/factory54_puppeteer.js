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

                        // --- STRICT RELEVANCE FILTER ---
                        if (title) {
                            const titleLower = title.toLowerCase();

                            // 1. Blacklist Check
                            const blacklist = ['מסכה', 'מכנס', 'חולצה', 'תיק', 'mask', 'pants', 'shirt', 'bag', 'jacket', 'hoodie', 'sweatshirt', 'socks', 'hat', 'cap', 'גרביים', 'כובע', 'ארנק', 'wallet'];
                            const isBlacklisted = blacklist.some(word => titleLower.includes(word));

                            if (isBlacklisted) {
                                // console.log(`[Factory54] Filtered out blacklisted item: ${title}`);
                                return;
                            }
                        }
                        // -------------------------------

                        results.push({
                            title: title || 'N/A',
                            price: price || 0,
                            store: 'Factory 54',
                            link: href,
                            image: image,
                            brand: brand || 'N/A'
                        });

                    } catch (err) { }
                });
                return results;
            });

            // --- Post-Processing: Fuzzy Token Match ---
            // Ensure title contains at least ONE significant token from the query if it's specific
            // Actually, the user asked for "Strict Relevance".
            // Let's filter by checking if the query tokens are loosely present.
            const queryLower = this.query.toLowerCase();
            const queryTokens = queryLower.split(' ').filter(t => t.length > 2); // Only significant words

            const filteredProducts = products.filter(p => {
                if (queryTokens.length === 0) return true; // Short query, keep all
                const titleLower = p.title.toLowerCase();
                // Check if at least ONE token matches (relaxed) or ALL?
                // User complaint: "530" returned masks.
                // If query is "New Balance 530", we expect "530" to be there.
                // Let's require at least one match if tokens exist.
                return queryTokens.some(t => titleLower.includes(t)) || (p.brand && queryTokens.some(t => p.brand.toLowerCase().includes(t)));
            });

            console.log(`[Factory54] Scraped ${products.length} items. Kept ${filteredProducts.length} after strict filter.`);
            return filteredProducts;

        } catch (e) {
            console.error("[Factory54] Error:", e.message);
            return [];
        } finally {
            if (page) await page.close();
        }
    }
}

module.exports = Factory54PuppeteerScraper;
