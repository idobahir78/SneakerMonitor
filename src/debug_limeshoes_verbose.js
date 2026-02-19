const Scraper = require('./scrapers/limeshoes');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({ headless: "new" });
    const scraper = new Scraper("Nike");
    console.log("Testing LimeShoes Verbose...");

    // Override log to capture internal output
    const originalLog = console.log;

    // Hook into scrape-time logging if possible, or just rely on console output
    // Actually, I'll just run it and let it log to stdout, capturing the 'Found 1 raw items' part
    // But I can't easily modify the class to log the *item* without editing the file.
    // Wait, the class returns the *filtered* items.
    // I need to modify `limeshoes.js` to log the raw items or return them for debugging.

    // Easier: Modify `limeshoes.js` to log the first raw item before filtering.
    // But I can just read the file and replicate the logic here.

    // Quickest: Modify `limeshoes.js` temporarily to log raw items.

    try {
        const results = await scraper.scrape(browser);
    } catch (e) { console.error(e); }

    await browser.close();
})();
