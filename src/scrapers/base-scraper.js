class BaseScraper {
    constructor(storeName, url) {
        this.storeName = storeName;
        this.url = url;
    }

    /**
     * Scrapes the target URL using the provided browser instance.
     * @param {import('puppeteer').Browser} browser 
     */
    /**
      * Scrapes the target URL using the provided browser instance.
      * @param {import('puppeteer').Browser} browser 
      * @param {RegExp[]} modelPatterns - Patterns to filter products by title (Smart Search)
      * @param {number[]|string[]|null} targetSizes - Sizes to filter by. If null, no deep scrape.
      */
    async scrape(browser, modelPatterns, targetSizes) {
        let page;
        try {
            page = await browser.newPage();
            // Set viewport to look like a desktop
            await page.setViewport({ width: 1366, height: 768 });

            // if (process.env.DEBUG_LOGS) {
            //     page.on('console', msg => console.log('PAGE LOG:', msg.text()));
            // }

            await page.setRequestInterception(true);
            page.on('request', (req) => {
                const resourceType = req.resourceType();
                // Relaxed blocking: Only block media to save bandwidth, allow fonts/styles/images for accurate rendering/anti-bot
                if (['media'].includes(resourceType)) {
                    req.abort();
                } else {
                    req.continue();
                }
            });

            // console.log(`Navigating to ${this.storeName}...`);
            await this.navigate(page);

            // Wait a bit more for dynamic content (hydration)
            // Some sites need a few seconds after load to render products
            try {
                await page.waitForTimeout(3000);
            } catch (e) { }

            // 1. Initial Scrape (Get List)
            let items = await this.parse(page);

            // DEBUG: Screenshot & HTML if 0 items found
            if (items.length === 0) {
                // console.log(`[${this.storeName}] 0 items found. Saving debug data...`);
                const fs = require('fs');
                if (!fs.existsSync('debug_screenshots')) fs.mkdirSync('debug_screenshots');
                const cleanName = this.storeName.replace(/\\s/g, '_');

                await page.screenshot({ path: `debug_screenshots/${cleanName}_debug.png` });
                const html = await page.content();
                fs.writeFileSync(`debug_screenshots/${cleanName}_debug.html`, html);
            }

            // 2. Filter by Title (Smart Search) ASAP to reduce work
            if (modelPatterns && modelPatterns.length > 0) {
                items = items.filter(item => {
                    const titleUpper = item.title.toUpperCase();
                    return modelPatterns.some(pattern => pattern.test(titleUpper));
                });
            }

            // console.log(`[${this.storeName}] Found ${items.length} potential matches after title filter.`);

            // 3. Deep Verification (If sizes requested)
            if (targetSizes && targetSizes.length > 0 && items.length > 0) {
                // console.log(`[${this.storeName}] Deep verifying sizes for ${items.length} items...`);
                const verifiedItems = [];

                // Process sequentially to be safe with resources, or semi-parallel?
                // Sequential is safer for now to avoid detection/resource limits.
                for (const item of items) {
                    // If scraper already found sizes (e.g. from grid), check them.
                    if (item.sizes && item.sizes.length > 0) {
                        const hasSize = item.sizes.some(s => targetSizes.includes(s) || targetSizes.includes(parseFloat(s)));
                        if (hasSize) verifiedItems.push(item);
                        continue;
                    }

                    // If sizes unknown, we must deep scrape
                    try {
                        // console.log(`   Checking sizes for: ${item.title}`);
                        // Navigate to product page
                        await page.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 30000 });

                        // Helper hook for subclasses to extract sizes from PDP
                        const sizes = await this.parseSizes(page);
                        // console.log(`     Found sizes: ${sizes.join(', ')}`);

                        const hasSize = sizes.some(s => targetSizes.includes(s) || targetSizes.includes(parseFloat(s)));
                        if (hasSize) {
                            item.sizes = sizes; // Update item with real sizes
                            verifiedItems.push(item);
                        }
                    } catch (e) {
                        console.error(`     Error verifying ${item.title}: ${e.message}`);
                    }
                }
                return verifiedItems;

            } else {
                // Return all if no specific size requested (or if list empty)
                return items;
            }

        } catch (error) {
            console.error(`Error scraping ${this.storeName}: ${error.message}`);
            return [];
        } finally {
            if (page) await page.close();
        }
    }

    /**
     * Navigates to the target URL. Subclasses can override this for complex interactions.
     * @param {import('puppeteer').Page} page
     */
    async navigate(page) {
        await page.goto(this.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    }

    /**
     * Parses the page to extract products.
     * @param {import('puppeteer').Page} page 
     */
    async parse(page) {
        throw new Error('parse() method must be implemented by subclass');
    }

    /**
     * Extracts available sizes from a Product Detail Page (PDP).
     * @param {import('puppeteer').Page} page
     */
    async parseSizes(page) {
        // Default implementation: return empty (subclasses must override)
        return [];
    }
}

module.exports = BaseScraper;
