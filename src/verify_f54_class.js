const Scraper = require('./scrapers/factory54_puppeteer');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({ headless: "new" });
    const scraper = new Scraper("Nike");
    console.log("Testing Factory54 Scraper Class with query: Nike");

    try {
        const results = await scraper.scrape(browser);
        console.log(`Found ${results.length} items.`);
        if (results.length > 0) {
            console.log("First item:", JSON.stringify(results[0], null, 2));
        } else {
            console.log("No items found.");
        }
    } catch (e) {
        console.error("Scrape Error:", e);
    }

    await browser.close();
})();
