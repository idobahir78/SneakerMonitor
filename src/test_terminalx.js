const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const TerminalXScraper = require('./scrapers/terminalx');

async function test() {
    console.log('Testing Terminal X Scraper...');
    const browser = await puppeteer.launch({ headless: false });

    try {
        const scraper = new TerminalXScraper('puma lamelo');
        // Test with empty patterns/sizes just to get the list
        const results = await scraper.scrape(browser, [], []);

        console.log(`Found ${results.length} results.`);
        if (results.length > 0) {
            console.log('Sample Result:', results[0]);
        } else {
            console.log('Zero results found. Check debug screenshots.');
        }
    } catch (e) {
        console.error('Test failed:', e);
    } finally {
        await browser.close();
    }
}

test();
