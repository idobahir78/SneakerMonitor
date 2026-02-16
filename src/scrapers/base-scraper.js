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
            await new Promise(r => setTimeout(r, 3000));

            // 1. Initial Scrape (Get List)
            let items = await this.parse(page);

            // DEBUG: Screenshot & HTML if 0 items found
            if (items.length === 0) {
                // console.log(`[${this.storeName}] 0 items found. Saving debug data...`);
                const fs = require('fs');
                if (!fs.existsSync('debug_screenshots')) fs.mkdirSync('debug_screenshots');
                const cleanName = this.storeName.replace(/\s/g, '_');

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
                const verifiedItems = [];

                // Process in small batches to balance speed vs reliability
                const BATCH_SIZE = 3;
                for (let i = 0; i < items.length; i += BATCH_SIZE) {
                    const batch = items.slice(i, i + BATCH_SIZE);

                    const batchPromises = batch.map(async (item) => {
                        // If scraper already found sizes (e.g. from grid), check them.
                        if (item.sizes && item.sizes.length > 0) {
                            const hasSize = item.sizes.some(s => targetSizes.includes(s) || targetSizes.includes(parseFloat(s)));
                            if (hasSize) verifiedItems.push(item);
                            return;
                        }

                        // If sizes unknown, we must deep scrape
                        try {
                            const detailPage = await browser.newPage();
                            await detailPage.setViewport({ width: 1366, height: 768 });

                            await detailPage.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 30000 });
                            const sizes = await this.parseSizes(detailPage);
                            await detailPage.close();

                            const hasSize = sizes.some(s => targetSizes.includes(s) || targetSizes.includes(parseFloat(s)));
                            if (hasSize) {
                                item.sizes = sizes; // Update item with real sizes
                                verifiedItems.push(item);
                            }
                        } catch (e) {
                            console.error(`     Error verifying ${item.title}: ${e.message}`);
                        }
                    });

                    await Promise.all(batchPromises);
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
        // Randomize User-Agent for each navigation to avoid fingerprints
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0'
        ];
        const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)];
        await page.setUserAgent(randomUA);

        // Add a tiny random delay before navigation
        await new Promise(r => setTimeout(r, Math.random() * 2000));

        await page.goto(this.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    }

    /**
     * Helper to wait for a random amount of time (simulate human jitter)
     */
    async jitter(min = 500, max = 1500) {
        const ms = Math.floor(Math.random() * (max - min) + min);
        await new Promise(r => setTimeout(r, ms));
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
