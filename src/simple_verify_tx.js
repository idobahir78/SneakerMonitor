const TerminalXScraper = require('./scrapers/terminalx_puppeteer');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    console.log("--- Starting Simple TX Verification ---");
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    try {
        const scraper = new TerminalXScraper("Nike");
        const results = await scraper.scrape(browser);
        console.log("--- Scrape Finished ---");
        console.log(`Count: ${results.length}`);
    } catch (e) {
        console.error("CRITICAL ERROR:", e);
    }
    await browser.close();
})();
