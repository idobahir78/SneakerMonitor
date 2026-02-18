const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

const Factory54Scraper = require('./scrapers/factory54_puppeteer'); // Use the new one!
const TerminalXScraper = require('./scrapers/terminalx_puppeteer'); // Use the new one!
const FootLockerScraper = require('./scrapers/footlocker');
const MegaSportScraper = require('./scrapers/megasport');
const ShoesOnlineScraper = require('./scrapers/shoesonline');
const MayersScraper = require('./scrapers/mayers');

// Query that should definitely have results
const QUERY = process.argv[2] || "Nike";

const STORES = [
    // { name: 'Terminal X', Class: TerminalXScraper },
    // { name: 'Foot Locker', Class: FootLockerScraper },
    // { name: 'Factory 54', Class: Factory54Scraper },
    // { name: 'Mega Sport', Class: MegaSportScraper },
    { name: 'ShoesOnline', Class: ShoesOnlineScraper },
    { name: 'Mayers', Class: MayersScraper }
];

(async () => {
    // Launch browser
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
    });

    console.log(`🚀 Starting Search Debug (Query: "${QUERY}")...`);
    let hasError = false;

    for (const store of STORES) {
        console.log(`\n🔍 Testing ${store.name}...`);
        let page = null;
        try {
            page = await browser.newPage();
            await page.setViewport({ width: 1366, height: 768 });

            const scraper = new store.Class(QUERY);

            // Check if scraper has navigate method (BaseScraper) or handles it in parse (PuppeteerScraper)
            // Our new puppeteer scrapers (F54, TX) usually have 'parse()' handling navigation?
            // Let's check:
            // TerminalXScraper (puppeteer) -> parse() launches its own browser? 
            // WAIT. The new puppeteer scrapers launched their OWN browser internally in previous steps.
            // If I call them here, passing 'page' might not work if they don't support it.
            // I need to check `factory54_puppeteer.js` code I wrote.

            // Checking Factory54PuppeteerScraper: 
            // parse() { const browser = await puppeteer.launch(...) ... }
            // It launches its OWN browser. It does NOT accept a page argument.

            // Checking TerminalXScraper (terminalx_puppeteer.js):
            // It also likely launches its own browser.

            // BUT ShoesOnlineScraper extends BaseScraper, so it expects `parse(page)`.

            // Adaptation Layer:
            let items = [];

            // Check for new "scrape(browser)" interface (Factory 54, Terminal X)
            if (typeof scraper.scrape === 'function') {
                // These Launch their own page via browser context
                if (page && !page.isClosed()) await page.close(); // Close empty page
                items = await scraper.scrape(browser);
            } else {
                // Standard Scrapers (BaseScraper) - expect navigate(page) -> parse(page)
                await scraper.navigate(page);
                await new Promise(r => setTimeout(r, 5000));
                items = await scraper.parse(page);
                if (page && !page.isClosed()) await page.close();
            }

            console.log(`   ✅ Parsed ${items.length} items.`);

            // Validation Rule: No Data = Crash
            if (items.length === 0) {
                console.error(`   ❌ [CRITICAL] 0 Items found for ${store.name}! Blocking or Layout Change detected.`);
                throw new Error(`Zero results for ${store.name}`);
            } else {
                const s = items[0];
                console.log(`   Sample: ${s.title} - ${s.price} [Store: ${s.store || 'MISSING'}] [Brand: ${s.brand || 'N/A'}]`);
            }

        } catch (e) {
            console.error(`   ❌ Failed: ${e.message}`);
            hasError = true;
            if (page && !page.isClosed()) await page.close();
        }
    }

    await browser.close();

    if (hasError) {
        console.error("\n❌ TESTS FAILED: One or more scrapers failed validation.");
        process.exit(1);
    } else {
        console.log("\n✅ ALL TESTS PASSED.");
        process.exit(0);
    }
})();
