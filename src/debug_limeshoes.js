const Scraper = require('./scrapers/limeshoes');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({ headless: "new" });
    const scraper = new Scraper("Nike");
    console.log("Testing LimeShoes with query: Nike");
    try {
        const results = await scraper.scrape(browser);
        console.log(`Results: ${results.length}`);
    } catch (e) {
        console.error(e);
    }
    await browser.close();
})();
