const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const MegaSport = require('./src/scrapers/mega-sport');
const TerminalX = require('./src/scrapers/terminalx');
const FootLocker = require('./src/scrapers/footlocker');

puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized']
    });

    console.log('--- Debugging "Lamelo mb.05" Search ---');

    // Test 1: Specific Query "Lamelo mb.05"
    console.log('\n--- Test 1: Query = "Lamelo mb.05" ---');
    const s1 = new MegaSport('Lamelo mb.05');
    const s2 = new TerminalX('Lamelo mb.05');
    const s3 = new FootLocker('Lamelo mb.05');

    const scrapers1 = [s1, s2, s3];

    for (const scraper of scrapers1) {
        try {
            console.log(`\nTesting ${scraper.storeName}...`);
            // We call scrape() with null patterns/sizes to bypass internal filtering
            // so we see exactly what the site returned.
            const results = await scraper.scrape(browser, null, null);
            console.log(`   Found: ${results.length} items`);
            if (results.length > 0) {
                console.log(`   First Item: "${results[0].title}" - Price: ${results[0].price}`);
            }
        } catch (e) {
            console.error(`   Error scraping ${scraper.storeName}:`, e.message);
        }
    }

    // Test 2: Broader Query "MB.05"
    console.log('\n--- Test 2: Query = "MB.05" ---');
    const s4 = new MegaSport('MB.05');
    const s5 = new TerminalX('MB.05');
    const s6 = new FootLocker('MB.05');

    const scrapers2 = [s4, s5, s6];

    for (const scraper of scrapers2) {
        try {
            console.log(`\nTesting ${scraper.storeName}...`);
            const results = await scraper.scrape(browser, null, null);
            console.log(`   Found: ${results.length} items`);
            if (results.length > 0) {
                console.log(`   First Item: "${results[0].title}" - Price: ${results[0].price}`);
            }
        } catch (e) {
            console.error(`   Error scraping ${scraper.storeName}:`, e.message);
        }
    }

    await browser.close();
})();
