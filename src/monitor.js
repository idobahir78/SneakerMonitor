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
const TerminalXScraper = require('./scrapers/terminalx');
const FootLockerScraper = require('./scrapers/footlocker');
const TheShovalScraper = require('./scrapers/theshoval');
const BallersScraper = require('./scrapers/ballers');
const PlayerSixScraper = require('./scrapers/player-six');
const NikeILScraper = require('./scrapers/nike-il');
const KitsClubScraper = require('./scrapers/kits-club');
const MegaSportScraper = require('./scrapers/mega-sport');
const ShoesOnlineScraper = require('./scrapers/shoesonline');
const MasterSportScraper = require('./scrapers/mastersport');
const ZolSportScraper = require('./scrapers/zolsport');
const AlufSportScraper = require('./scrapers/alufsport');
const LimeShoesScraper = require('./scrapers/limeshoes');
const MayersScraper = require('./scrapers/mayers');
const Shoes2uScraper = require('./scrapers/shoes2u');
const Arba4Scraper = require('./scrapers/arba4');
const KSPScraper = require('./scrapers/ksp');

// --- USER CONFIGURATION (CLI SUPPORT) ---
const args = process.argv.slice(2);

// Arg 0: Search Input
const DEFAULT_SEARCH = "MB.05, MB.04, MB.03, LaMelo, Wade, LeBron, Freak";

// Check if we should load the last search from data.json (for scheduled runs)
const shouldLoadLast = args.includes('--load-last');
let RAW_SEARCH_INPUT = args[0] && !args[0].startsWith('--') ? args[0] : DEFAULT_SEARCH;
let SIZE_INPUT = args[1]; // Can be undefined

if (shouldLoadLast) {
    try {
        const jsonPath = process.env.EXPORT_JSON || path.join(__dirname, '../frontend/public/data.json');
        if (fs.existsSync(jsonPath)) {
            const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            if (data.lastSearchTerm) {
                console.log(`🔄 Loaded last search term: "${data.lastSearchTerm}"`.cyan);
                RAW_SEARCH_INPUT = data.lastSearchTerm;
            }
            if (data.lastSizeInput) {
                console.log(`🔄 Loaded last size input: "${data.lastSizeInput}"`.cyan);
                SIZE_INPUT = data.lastSizeInput;
            }
        }
    } catch (e) {
        console.error("Failed to load last search:", e.message);
    }
}

// Simplify query to improve match rate (e.g. "Lamelo MB.05" -> "MB.05")
const SEARCH_INPUT = SmartSearch.simplifyQuery(RAW_SEARCH_INPUT);

// Arg 2: Size Input
// Arg 3: Stores Filter (--stores=Nike,Adidas or --stores=group1)
let STORE_FILTER = [];
const storesArg = args.find(arg => arg.startsWith('--stores='));
if (storesArg) {
    const rawStores = storesArg.split('=')[1];
    STORE_FILTER = rawStores.split(',').map(s => s.trim().toLowerCase());
    console.log(`🏬 Store Filter Active: [${STORE_FILTER.join(', ')}]`.magenta);
}

// Generate Regex patterns dynamically
const TARGET_MODELS = SmartSearch.generatePatterns(SEARCH_INPUT);

// Generate target sizes
let TARGET_SIZES;
if (SIZE_INPUT) {
    TARGET_SIZES = SizeUtils.getRelatedSizes(SIZE_INPUT);
} else {
    TARGET_SIZES = null; // null means "all sizes"
}

// Progressive updates flag (enable for real-time updates during manual runs)
const PROGRESSIVE_UPDATES = process.env.PROGRESSIVE_UPDATES === 'true';

// Helper function to write progressive updates
function writeProgressiveUpdate(results, isRunning = true) {
    if (!PROGRESSIVE_UPDATES) return; // Skip if not in progressive mode

    const outputPath = process.env.EXPORT_JSON || path.join(__dirname, '../frontend/public/data.json');
    const outputData = {
        lastUpdated: new Date().toISOString(),
        isRunning: isRunning,
        lastSearchTerm: RAW_SEARCH_INPUT,
        lastSizeInput: SIZE_INPUT || null,
        filters: {
            models: TARGET_MODELS.map(r => r.source),
            sizes: TARGET_SIZES || []
        },
        results: results
    };

    try {
        fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
        if (isRunning) {
            console.log(`   💾 Progressive update: ${results.length} results saved...`.dim);
        }
    } catch (err) {
        console.error(`   ⚠️ Failed to write progressive update: ${err.message}`.yellow);
    }
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

        // Factory function to create fresh scrapers for each query variation
        const createScrapers = (searchQuery) => [
            new Factory54Scraper(searchQuery),
            new TerminalXScraper(searchQuery),
            new FootLockerScraper(searchQuery),
            new TheShovalScraper(searchQuery),
            new BallersScraper(searchQuery),
            new PlayerSixScraper(searchQuery),
            new NikeILScraper(searchQuery),
            new KitsClubScraper(searchQuery),
            new MegaSportScraper(searchQuery),
            new ShoesOnlineScraper(searchQuery),
            new MasterSportScraper(searchQuery),
            new ZolSportScraper(searchQuery),
            new AlufSportScraper(searchQuery),
            new LimeShoesScraper(searchQuery),
            new MayersScraper(searchQuery),
            new Shoes2uScraper(searchQuery),
            new Arba4Scraper(searchQuery),
            new KSPScraper(searchQuery)
        ];

        // Generate query variations
        const queryVariations = SmartSearch.generateQueryVariations(SEARCH_INPUT);
        console.log(`🔄 Query Variations: [${queryVariations.join(', ')}]`.cyan);

        let allResults = [];

        // Run all variations in parallel (restore original speed!)
        const variationPromises = queryVariations.map(async (queryVariation) => {
            console.log(`\n🔍 Trying variation: "${queryVariation}"...`.yellow);

            const allScrapers = createScrapers(queryVariation);

            // Filter scrapers if needed
            let scrapers = allScrapers;
            if (STORE_FILTER.length > 0) {
                scrapers = allScrapers.filter(s =>
                    STORE_FILTER.some(filter => s.storeName.toLowerCase().includes(filter))
                );
            }

            if (scrapers.length === 0) {
                console.log("⚠️ No scrapers matched the filter!".red);
                return []; // Return empty array for this variation
            }

            // Run scrapers in parallel for this variation
            const scrapePromises = scrapers.map(async (scraper) => {
                try {
                    const results = await scraper.scrape(browser, TARGET_MODELS, TARGET_SIZES);

                    if (results.length > 0) {
                        console.log(`   ✅ ${scraper.storeName}: ${results.length} matches`);

                        // Progressive update: write after each successful scraper
                        if (PROGRESSIVE_UPDATES) {
                            // Collect all results so far (need to merge with existing)
                            allResults = allResults.concat(results);

                            // Deduplicate before writing
                            const uniqueSoFar = [];
                            const seenLinks = new Set();
                            for (const r of allResults) {
                                if (!seenLinks.has(r.link)) {
                                    seenLinks.add(r.link);
                                    uniqueSoFar.push(r);
                                }
                            }

                            writeProgressiveUpdate(uniqueSoFar, true);
                        }
                    }

                    return results;
                } catch (err) {
                    // Silent error handling for variations
                    return [];
                }
            });

            const results = await Promise.all(scrapePromises);

            // Flatten this variation's results
            const flatResults = [];
            results.forEach(siteResults => {
                flatResults.push(...siteResults);
            });

            return flatResults;
        });

        // Wait for all variations to complete
        const variationResults = await Promise.all(variationPromises);

        // Flatten all variation results
        variationResults.forEach(results => {
            allResults = allResults.concat(results);
        });

        // Deduplicate by link (same product from different query variations)
        const uniqueResults = [];
        const seenLinks = new Set();

        for (const result of allResults) {
            if (!seenLinks.has(result.link)) {
                seenLinks.add(result.link);
                uniqueResults.push(result);
            }
        }

        console.log(`\n📊 Total: ${uniqueResults.length} unique products (from ${allResults.length} total across all variations)`.green.bold);

        // Results are already filtered and verified by BaseScraper!
        const filteredResults = uniqueResults;

        // Sort by price
        filteredResults.sort((a, b) => a.price - b.price);

        // Display results
        if (filteredResults.length > 0) {
            console.log(`\n🎉 Found ${filteredResults.length} matches!`.green.bold);

            filteredResults.forEach((item, index) => {
                const store = item.store || 'Unknown';
                const title = item.title || 'N/A';
                const price = item.price ? `₪${item.price}` : 'N/A';
                const sizes = item.sizes && item.sizes.length > 0 ? item.sizes.join(', ') : 'All/Unknown';
                const link = item.link || '';

                console.log(`${index + 1}. ${store.padEnd(20)} | ${title.substring(0, 40).padEnd(42)} | ${price.padEnd(10)} | Sizes: ${sizes}`);
            });
        } else {
            console.log(`❌ No matches found.`.red);
        }

        await browser.close();

        // --- EXPORT TO JSON ---
        const outputPath = process.env.EXPORT_JSON || path.join(__dirname, '../frontend/public/data.json');
        const outputData = {
            lastUpdated: new Date().toISOString(),
            isRunning: false, // Scan complete!
            lastSearchTerm: RAW_SEARCH_INPUT,
            lastSizeInput: SIZE_INPUT || null,
            filters: {
                models: TARGET_MODELS.map(r => r.source), // Store source strings
                sizes: TARGET_SIZES || []
            },
            results: filteredResults
        };

        fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
        console.log(`\n💾 Saved to ${outputPath}`.cyan);

    } catch (error) {
        console.error(`\n❌ Fatal Error: ${error.message}`.red);
        if (browser) await browser.close();
        process.exit(1);
    }
}

// Execute immediately
run();
