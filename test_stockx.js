const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const StockXScraper = require('./src/scrapers/stockx');

puppeteer.use(StealthPlugin());

(async () => {
    console.log('--- Debugging StockX Scraper ---');
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized']
    });

    const scraper = new StockXScraper('Lamelo mb.05');

    try {
        console.log(`Navigating to: ${scraper.url}`);
        const results = await scraper.scrape(browser, null, null);

        console.log(`\nFound ${results.length} items.`);
        if (results.length > 0) {
            console.log('Sample item:', results[0]);
        } else {
            console.log('❌ No items found. Check the browser window for CAPTCHA or layout changes.');
        }

    } catch (e) {
        console.error('Scrape failed:', e);
    }

    // Keep browser open for a moment to inspect
    console.log('Closing browser in 30 seconds...');
    await new Promise(r => setTimeout(r, 30000));
    await browser.close();
})();
