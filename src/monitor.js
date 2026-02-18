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

const Factory54Scraper = require('./scrapers/factory54_puppeteer');
const TerminalXScraper = require('./scrapers/terminalx_puppeteer');
const FootLockerScraper = require('./scrapers/footlocker');
const TheShovalScraper = require('./scrapers/theshoval');
const BallersScraper = require('./scrapers/ballers');
const PlayerSixScraper = require('./scrapers/player-six');
const NikeILScraper = require('./scrapers/nike-il');
const KitsClubScraper = require('./scrapers/kits-club');
const MegaSportScraper = require('./scrapers/megasport');
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
console.log("DEBUG ARGS:", JSON.stringify(args)); // Debugging

// Arg 0: Search Input
const shouldLoadLast = args.includes('--load-last');
let RAW_SEARCH_INPUT = args[0] !== undefined && !args[0].startsWith('--') ? args[0] : null;
let SIZE_INPUT = args[1] !== undefined && !args[1].startsWith('--') ? args[1] : null;

console.log("DEBUG RAW_SEARCH_INPUT:", JSON.stringify(RAW_SEARCH_INPUT));
console.log("DEBUG SIZE_INPUT:", JSON.stringify(SIZE_INPUT));
console.log("DEBUG shouldLoadLast:", shouldLoadLast);

// Error out if no search term provided and not loading last
if ((!RAW_SEARCH_INPUT || RAW_SEARCH_INPUT.trim() === '') && !shouldLoadLast) {
    // Fallback instead of crash for robustness in CI
    console.error("\n⚠️ Warning: No search term provided. Defaulting to 'Nike'.".yellow.bold);
    RAW_SEARCH_INPUT = "Nike";
    // console.error("\n❌ Error: No search term provided!".red.bold);
    // console.log("Usage: node src/monitor.js \"search term\" [sizes] [--load-last] [--stores=...]".yellow);
    // process.exit(1);
}

if (shouldLoadLast) {
    try {
        // ALWAYS load from the main data file, even if exporting to a partial file
        const loadPath = path.join(__dirname, '../frontend/public/data.json');

        console.log(`DEBUG: Checking for data file at: ${loadPath}`);
        if (fs.existsSync(loadPath)) {
            console.log("DEBUG: Data file found! Reading...");
            const data = JSON.parse(fs.readFileSync(loadPath, 'utf8'));
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

// Arg 4: Custom JSON output file (--json=filename.json)
const jsonArg = args.find(arg => arg.startsWith('--json'));
if (jsonArg) {
    // Support both --json filename.json and --json=filename.json
    let jsonFile;
    if (jsonArg.includes('=')) {
        jsonFile = jsonArg.split('=')[1];
    } else {
        const jsonIndex = args.indexOf(jsonArg);
        jsonFile = args[jsonIndex + 1];
    }
    if (jsonFile && !jsonFile.startsWith('--')) {
        process.env.EXPORT_JSON = jsonFile;
        console.log(`📄 Custom Output File: ${jsonFile}`.cyan);
    }
}

// --- SMART SCHEDULING LOGIC ---
const triggerTypeArg = args.find(arg => arg.startsWith('--trigger-type='));
const TRIGGER_TYPE = triggerTypeArg ? triggerTypeArg.split('=')[1] : 'manual'; // 'manual', 'schedule', 'enable_auto'

const jsonPath = process.env.EXPORT_JSON || path.join(__dirname, '../frontend/public/data.json');
let currentData = {};

if (fs.existsSync(jsonPath)) {
    try {
        currentData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    } catch (e) {
        console.error("Failed to parse existing data.json:", e.message);
    }
}

// 1. Enable Auto Mode
if (TRIGGER_TYPE === 'enable_auto') {
    console.log('\n🔄 Enabling Auto-Scan Mode...'.green.bold);
    currentData.autoScrapeEnabled = true;
    currentData.isRunning = false; // Reset running state
    fs.writeFileSync(jsonPath, JSON.stringify(currentData, null, 2));
    console.log('✅ Auto-Scan Enabled. Next scheduled run will execute.'.green);

    // Trigger Sync to save this state to GitHub
    const syncScript = path.join(__dirname, 'scripts/git_sync.js');
    try {
        console.log('🔄 Syncing state to GitHub...');
        require('child_process').execSync(`node "${syncScript}" "${jsonPath}"`, { stdio: 'inherit' });
        console.log('✅ State synced.');
    } catch (e) {
        console.error(`⚠️ Sync Failed: ${e.message}`);
    }
    process.exit(0);
}

// 2. Schedule Check
if (TRIGGER_TYPE === 'schedule') {
    // Default to enabled if undefined
    if (currentData.autoScrapeEnabled === false) {
        console.log('\n⏸️  Auto-Scan is DISABLED by user. Skipping scheduled run.'.yellow.bold);
        process.exit(0);
    }
    console.log('\n⏰ Scheduled Run - Auto-Scan is Enabled.'.green);
}

// 3. Manual Run -> Disable Auto
if (TRIGGER_TYPE === 'manual') {
    console.log('\n👤 Manual Run Detected - Disabling future Auto-Scans until re-enabled.'.magenta.bold);
    currentData.autoScrapeEnabled = false;
    try {
        fs.writeFileSync(jsonPath, JSON.stringify(currentData, null, 2));
    } catch (e) { }
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

/**
 * Simple concurrency limiter to prevent resource exhaustion
 * @param {number} limit 
 * @param {Array} items 
 * @param {Function} fn 
 */
async function limitConcurrency(limit, items, fn) {
    const results = [];
    const executing = new Set();
    for (const item of items) {
        const p = Promise.resolve().then(() => fn(item));
        results.push(p);
        executing.add(p);
        const clean = () => executing.delete(p);
        p.then(clean).catch(clean);
        if (executing.size >= limit) {
            await Promise.race(executing);
        }
    }
    return Promise.all(results);
}

// Global results accumulator for progressive updates
let allAccumulatedResults = [];

const { exec } = require('child_process');

// Helper function to write progressive updates
function writeProgressiveUpdate(isRunning = true) {
    if (!PROGRESSIVE_UPDATES) return; // Skip if not in progressive mode

    const outputPath = process.env.EXPORT_JSON || path.join(__dirname, '../frontend/public/data.json');

    // Deduplicate accumulated results before writing
    const uniqueSoFar = [];
    const seenLinks = new Set();

    // Helper to normalize link (strip query params)
    const normalizeLink = (url) => {
        try {
            return url.split('?')[0];
        } catch (e) { return url; }
    };

    for (const r of allAccumulatedResults) {
        const cleanLink = normalizeLink(r.link);
        if (!seenLinks.has(cleanLink)) {
            seenLinks.add(cleanLink);
            uniqueSoFar.push(r);
        }
    }

    const outputData = {
        updatedAt: new Date().toISOString(),
        isRunning: isRunning,
        searchTerm: RAW_SEARCH_INPUT,
        lastSizeInput: SIZE_INPUT || null,
        filters: {
            models: TARGET_MODELS.map(r => r.source),
            sizes: TARGET_SIZES || []
        },
        results: uniqueSoFar
    };

    try {
        fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
        if (isRunning && uniqueSoFar.length > 0) {
            console.log(`   💾 Progressive update: ${uniqueSoFar.length} results saved...`.dim);

            // --- TRIGGER GIT SYNC ---
            // Only sync if we have results and we are in a CI environment (checked via env var or assumption)
            // We assume safe to run if PROGRESSIVE_UPDATES is true.
            // Fire and forget-ish (don't await to avoid blocking scraping too much, but maybe we should?)
            // We'll run it detached? No, simple exec.
            const syncScript = path.join(__dirname, 'scripts/git_sync.js');
            console.log(`   🔄 Triggering background git sync...`.dim);
            exec(`node "${syncScript}" "${outputPath}"`, (error, stdout, stderr) => {
                if (error) {
                    console.error(`   ⚠️ Sync Warning: ${error.message}`.yellow);
                    return;
                }
                if (stdout) console.log(`   [Sync] ${stdout.trim()}`.gray);
                if (stderr) console.error(`   [Sync Err] ${stderr.trim()}`.gray);
            });
        }
    } catch (err) {
        console.error(`   ⚠️ Failed to write progressive update: ${err.message}`.yellow);
    }
}
async function run() {
    console.log(`\nStarting scrape at ${new Date().toLocaleTimeString()}...`.cyan);
    console.log(`🔎 Searching for: "${SEARCH_INPUT}"`.yellow.bold);

    // Immediate feedback: mark as running in data.json
    writeProgressiveUpdate(true);

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

        // Factory function to create scrapers
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

        // Flatten all scraper tasks to allow global concurrency control
        const workTasks = [];
        queryVariations.forEach(queryVariation => {
            const allScrapers = createScrapers(queryVariation);

            // Filter scrapers if needed
            let scrapers = allScrapers;
            if (STORE_FILTER.length > 0) {
                scrapers = allScrapers.filter(s =>
                    STORE_FILTER.some(filter => s.storeName.toLowerCase().includes(filter))
                );
            }

            scrapers.forEach(scraper => {
                workTasks.push({ query: queryVariation, scraper });
            });
        });

        console.log(`🚀 Queueing ${workTasks.length} scraper tasks (Global Concurrency Limit: 5)`.yellow);

        const executeTask = async (task) => {
            const { query, scraper } = task;
            try {
                const results = await scraper.scrape(browser, TARGET_MODELS, TARGET_SIZES);

                if (results.length > 0) {
                    console.log(`   ✅ ${scraper.storeName}: ${results.length} matches [Query: ${query}]`);

                    // Add to global accumulator
                    allAccumulatedResults.push(...results);

                    // Write update
                    writeProgressiveUpdate(true);
                }
                return results;
            } catch (err) {
                console.error(`   ❌ ${scraper.storeName} failed:`.red, err.message);
                return [];
            }
        };

        // Run with global limit of 5 concurrent scrapers
        await limitConcurrency(5, workTasks, executeTask);

        // Final Deduplication
        const seenLinks = new Set();
        const uniqueResults = [];

        const normalizeLink = (url) => {
            try { return url.split('?')[0]; } catch (e) { return url; }
        };

        for (const result of allAccumulatedResults) {
            const cleanLink = normalizeLink(result.link);
            if (!seenLinks.has(cleanLink)) {
                seenLinks.add(cleanLink);
                uniqueResults.push(result);
            }
        }

        console.log(`\n📊 Total: ${uniqueResults.length} unique products found.`.green.bold);

        // Sort by price
        uniqueResults.sort((a, b) => a.price - b.price);

        // Display results
        if (uniqueResults.length > 0) {
            console.log(`\n🎉 Found ${uniqueResults.length} matches!`.green.bold);

            uniqueResults.forEach((item, index) => {
                const store = item.store || 'Unknown';
                const title = item.title || 'N/A';
                const price = item.price ? `₪${item.price}` : 'N/A';
                const sizes = item.sizes && item.sizes.length > 0 ? item.sizes.join(', ') : 'All/Unknown';

                console.log(`${index + 1}. ${store.padEnd(20)} | ${title.substring(0, 40).padEnd(42)} | ${price.padEnd(10)} | Sizes: ${sizes}`);
            });
        } else {
            console.log(`❌ No matches found.`.red);
        }

        await browser.close();

        // --- FINAL EXPORT ---
        const outputPath = process.env.EXPORT_JSON || path.join(__dirname, '../frontend/public/data.json');
        const outputData = {
            lastUpdated: new Date().toISOString(),
            isRunning: false,
            lastSearchTerm: RAW_SEARCH_INPUT,
            lastSizeInput: SIZE_INPUT || null,
            filters: {
                models: TARGET_MODELS.map(r => r.source),
                sizes: TARGET_SIZES || []
            },
            results: uniqueResults
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
