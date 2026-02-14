const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const colors = require('colors');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const SmartSearch = require('./utils/smart-search');
const SizeUtils = require('./utils/size-utils');

// Add stealth plugin to evade detection (StockX etc)
puppeteer.use(StealthPlugin());

const Factory54Scraper = require('./scrapers/factory54');
const StockXScraper = require('./scrapers/stockx');
const TerminalXScraper = require('./scrapers/terminalx');
const FootLockerScraper = require('./scrapers/footlocker');
const TheShovalScraper = require('./scrapers/theshoval');
const BallersScraper = require('./scrapers/ballers');
const PlayerSixScraper = require('./scrapers/player-six');
const NikeILScraper = require('./scrapers/nike-il');
const KitsClubScraper = require('./scrapers/kits-club');
const MegaSportScraper = require('./scrapers/mega-sport');

// --- USER CONFIGURATION (CLI SUPPORT) ---
const args = process.argv.slice(2);

// Arg 0: Search Input
const DEFAULT_SEARCH = "MB.05, MB.04, MB.03, LaMelo, Wade, LeBron, Freak";
const RAW_SEARCH_INPUT = args[0] ? args[0] : DEFAULT_SEARCH;
// Simplify query to improve match rate (e.g. "Lamelo MB.05" -> "MB.05")
const SEARCH_INPUT = SmartSearch.simplifyQuery(RAW_SEARCH_INPUT);

// Arg 1: Size Input
const DEFAULT_SIZES = [44, 45, 9.5, 10.5, 11, 11.5, 12];
const SIZE_INPUT = args[1]; // Can be undefined

// Generate Regex patterns dynamically
const TARGET_MODELS = SmartSearch.generatePatterns(SEARCH_INPUT);

// Generate target sizes
let TARGET_SIZES;
if (SIZE_INPUT) {
    TARGET_SIZES = SizeUtils.getRelatedSizes(SIZE_INPUT);
} else {
    TARGET_SIZES = DEFAULT_SIZES;
}

async function run() {
    console.log(`\nStarting scrape at ${new Date().toLocaleTimeString()}...`.cyan);
    console.log(`🔎 Searching for: "${SEARCH_INPUT}"`.yellow.bold);
    console.log(`   (Patterns: ${TARGET_MODELS.join(', ')})`.gray);

    if (TARGET_SIZES === null) {
        console.log(`📏 Size Filter: ALL SIZES (*)`.magenta.bold);
    } else {
        console.log(`📏 Size Filter: [${TARGET_SIZES.join(', ')}] (Auto-converted EU/US)`.magenta);
    }

    let browser;
    try {
        // Launch browser
        browser = await puppeteer.launch({
            headless: "new", // Must be headless for GitHub Actions!
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-features=IsolateOrigins,site-per-process']
        });

        // Initialize scrapers
        const scrapers = [
            new Factory54Scraper(SEARCH_INPUT),
            new StockXScraper(SEARCH_INPUT),
            new TerminalXScraper(SEARCH_INPUT),
            new FootLockerScraper(SEARCH_INPUT),
            new TheShovalScraper(SEARCH_INPUT),
            new BallersScraper(SEARCH_INPUT),
            new PlayerSixScraper(SEARCH_INPUT),
            new NikeILScraper(SEARCH_INPUT),
            new KitsClubScraper(SEARCH_INPUT),
            new MegaSportScraper(SEARCH_INPUT)
        ];

        let allResults = [];

        // Run scrapers in parallel-ish (but deep scrape is sequential internal)
        const scrapePromises = scrapers.map(scraper => {
            // Pass patterns and sizes to scrape method
            return scraper.scrape(browser, TARGET_MODELS, TARGET_SIZES)
                .then(results => {
                    console.log(`✅ ${scraper.storeName}: Found ${results.length} verified matches.`);
                    return results;
                })
                .catch(err => {
                    console.error(`❌ ${scraper.storeName} failed:`, err);
                    return [];
                });
        });

        const results = await Promise.all(scrapePromises);

        // Flatten results
        results.forEach(siteResults => {
            allResults = allResults.concat(siteResults);
        });

        // Results are already filtered and verified by BaseScraper!
        const filteredResults = allResults;

        // Sort by price
        filteredResults.sort((a, b) => a.price - b.price);

        // Display results
        if (filteredResults.length > 0) {
            console.log(`\n🎉 Found ${filteredResults.length} matches!`.green.bold);

            filteredResults.forEach((item, index) => {
                const store = item.store || 'Unknown';
                const sizes = Array.isArray(item.sizes) ? item.sizes.join(', ') : (item.sizes || 'N/A');

                console.log(`#${index + 1}: [${store}] ${item.title}`.yellow);
                console.log(`    Price: ₪${item.price} (approx if USD)`.white);
                console.log(`    Available Sizes: ${sizes}`.cyan);
                console.log(`    Link: ${item.link}`.blue.underline);
                console.log('---');
            });
        } else {
            console.log(`\nNo matches found for [${SEARCH_INPUT}] with size filter at this time.`.gray);
        }

        // Export to JSON if requested (or default behavior for easier data passing)
        // Check for --json argument or file path in args
        const jsonArgIndex = args.indexOf('--json');
        let jsonPath = null;

        if (jsonArgIndex !== -1) {
            jsonPath = args[jsonArgIndex + 1] || 'data.json';
        } else if (process.env.EXPORT_JSON) {
            jsonPath = process.env.EXPORT_JSON;
        }

        if (jsonPath) {
            const dataToSave = {
                updatedAt: new Date().toISOString(),
                searchTerm: SEARCH_INPUT,
                filters: { sizes: TARGET_SIZES },
                results: filteredResults
            };

            const outputPath = path.resolve(jsonPath);
            fs.writeFileSync(outputPath, JSON.stringify(dataToSave, null, 2));
            console.log(`\n📄 Data exported to: ${outputPath}`.cyan.bold);
        }

    } catch (err) {
        console.error("Critical Monitor Error:", err);
    } finally {
        if (browser) await browser.close();
        console.log(`Done.`.magenta);
    }
}

run();
