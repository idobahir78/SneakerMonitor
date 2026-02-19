const Factory54Scraper = require('./scrapers/factory54_puppeteer');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    const scraper = new Factory54Scraper("On Cloud");

    console.log("Testing Factory 54 Scraper...");
    try {
        const results = await scraper.scrape(browser);
        console.log(`Found ${results.length} items.`);
        if (results.length > 0) {
            console.log("Sample:", results[0].title);
        } else {
            console.log("FAIL: 0 items");
        }
    } catch (e) {
        console.error("ERROR:", e);
    }

    await browser.close();
})();
