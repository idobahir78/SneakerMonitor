const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

const Factory54Scraper = require('./scrapers/factory54_puppeteer');
const TerminalXScraper = require('./scrapers/terminalx_puppeteer');
const FootLockerScraper = require('./scrapers/footlocker');
const MegaSportScraper = require('./scrapers/megasport');
const ShoesOnlineScraper = require('./scrapers/shoesonline');
const MayersScraper = require('./scrapers/mayers');
const AlufSportScraper = require('./scrapers/alufsport');
const LimeShoesScraper = require('./scrapers/limeshoes');
const Arba4Scraper = require('./scrapers/arba4');
const TheShovalScraper = require('./scrapers/theshoval');
const BallersScraper = require('./scrapers/ballers');
const PlayerSixScraper = require('./scrapers/player-six');
const KitsClubScraper = require('./scrapers/kits-club');
const MasterSportScraper = require('./scrapers/mastersport');
const ZolSportScraper = require('./scrapers/zolsport');
const Shoes2uScraper = require('./scrapers/shoes2u');
const KSPScraper = require('./scrapers/ksp');

// Query that should definitely have results
const QUERY = process.argv[2] || "Nike";

const STORES = [
    // Previously Verified
    // { name: 'Terminal X', Class: TerminalXScraper },
    // { name: 'Foot Locker', Class: FootLockerScraper },
    // { name: 'Factory 54', Class: Factory54Scraper },
    // { name: 'Mega Sport', Class: MegaSportScraper },
    // { name: 'ShoesOnline', Class: ShoesOnlineScraper },
    // { name: 'Mayers', Class: MayersScraper },

    // To Audit
    { name: 'Aluf Sport', Class: AlufSportScraper },
    { name: 'Lime Shoes', Class: LimeShoesScraper },
    { name: 'The Shoval', Class: TheShovalScraper },
    { name: 'Master Sport', Class: MasterSportScraper },
    { name: 'Zol Sport', Class: ZolSportScraper },
    { name: 'Shoes2u', Class: Shoes2uScraper },
];

const os = require('os');
const path = require('path');

(async () => {
    // Unique User Data Dir to prevent "Browser already running" locks
    const uniqueUserDataDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'puppeteer_debug_'));

    // Launch browser
    const browser = await puppeteer.launch({
        headless: "new",
        userDataDir: uniqueUserDataDir,
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

                // Debug: Check items before closing page
                if (items.length === 0) {
                    console.error(`   ❌ [CRITICAL] 0 Items found for ${store.name}! Capturing state before close...`);
                    const safeName = store.name.replace(/\s+/g, '_');
                    try {
                        await page.screenshot({ path: `debug_${safeName}.png`, fullPage: true });
                        const html = await page.content();
                        fs.writeFileSync(`debug_${safeName}.html`, html);
                        console.log(`   📸 Saved debug screenshot and HTML for "${store.name}"`);
                    } catch (err) {
                        console.error(`   ⚠️ Failed to capture debug artifacts: ${err.message}`);
                    }
                }

                if (page && !page.isClosed()) await page.close();
            }

            console.log(`   ✅ Parsed ${items.length} items.`);

            // Validation Rule: No Data = Crash
            if (items.length === 0) {
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
