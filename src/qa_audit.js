const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

// Import Scrapers
const Factory54Scraper = require('./scrapers/factory54_puppeteer');
const TerminalXScraper = require('./scrapers/terminalx_puppeteer');
const FootLockerScraper = require('./scrapers/footlocker');
const MegaSportScraper = require('./scrapers/megasport');
const ShoesOnlineScraper = require('./scrapers/shoesonline');
const LimeShoesScraper = require('./scrapers/limeshoes');
const AlufSportScraper = require('./scrapers/alufsport');
const ZolSportScraper = require('./scrapers/zolsport');
const MasterSportScraper = require('./scrapers/mastersport');
const Shoes2uScraper = require('./scrapers/shoes2u');
const KSPScraper = require('./scrapers/ksp');
const Arba4Scraper = require('./scrapers/arba4');
const TheShovalScraper = require('./scrapers/theshoval');
const PlayerSixScraper = require('./scrapers/player-six');
const BallersScraper = require('./scrapers/ballers');
const KitsClubScraper = require('./scrapers/kits-club');

// Define Test Cases
const TEST_CASES = [
    { brand: 'Jordan', query: 'Jordan', expectedMin: 1, expectedMax: 999 }, // Should find shoes, not just shirts
    { brand: 'On Cloud', query: 'On Cloud', expectedMin: 1 },
    { brand: 'New Balance', query: 'New Balance 530', expectedMin: 1 },
    { brand: 'Nike', query: 'Nike Dunk', expectedMin: 1 }
];

const STORES = [
    { name: 'Terminal X', Class: TerminalXScraper },
    { name: 'Factory 54', Class: Factory54Scraper },
    { name: 'Mega Sport', Class: MegaSportScraper },
    { name: 'ShoesOnline', Class: ShoesOnlineScraper },
    { name: 'Lime Shoes', Class: LimeShoesScraper },
    // Add others as needed
];

(async () => {
    puppeteer.use(StealthPlugin());
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const report = {};

    console.log("🚀 Starting Comprehensive QA Audit...");

    for (const testCase of TEST_CASES) {
        console.log(`\n🔍 Testing Query: "${testCase.query}"`);
        report[testCase.query] = {};

        for (const store of STORES) {
            console.log(`   Running ${store.name}...`);
            try {
                const scraper = new store.Class(testCase.query);
                let items = [];

                // Handle Different Scraper Interfaces
                if (typeof scraper.scrape === 'function') {
                    // New Interface
                    items = await scraper.scrape(browser);
                } else {
                    // Old Interface
                    const page = await browser.newPage();
                    await scraper.navigate(page);
                    items = await scraper.parse(page);
                    await page.close();
                }

                console.log(`   -> Found: ${items.length}`);

                // Sample Data for Verification
                const samples = items.slice(0, 3).map(i => i.title);

                report[testCase.query][store.name] = {
                    count: items.length,
                    samples: samples,
                    status: items.length >= (testCase.expectedMin || 0) ? 'PASS' : 'FAIL'
                };

            } catch (e) {
                console.error(`   -> Error: ${e.message}`);
                report[testCase.query][store.name] = {
                    count: 0,
                    error: e.message,
                    status: 'ERROR'
                };
            }
        }
    }

    await browser.close();

    console.log("\n📊 Final Report:");
    console.log(JSON.stringify(report, null, 2));

    fs.writeFileSync('qa_report.json', JSON.stringify(report, null, 2));
})();
