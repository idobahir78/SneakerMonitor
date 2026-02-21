const fs = require('fs');
const path = require('path');
const colors = require('colors');

const Orchestrator = require('./agents/Orchestrator');
const TerminalXAgent = require('./agents/TerminalXAgent');
const Factory54Agent = require('./agents/Factory54Agent');
const LimeShoesAgent = require('./agents/LimeShoesAgent');
const NikeIsraelAgent = require('./agents/NikeIsraelAgent');
const AdidasIsraelAgent = require('./agents/AdidasIsraelAgent');
const FootLockerIsraelAgent = require('./agents/FootLockerIsraelAgent');
const JDSportsAgent = require('./agents/JDSportsAgent');
const MayersAgent = require('./agents/MayersAgent');
const KicksAgent = require('./agents/KicksAgent');

// Puma Israel removed — il.puma.com is shut down as an online store
const NewBalanceIsraelAgent = require('./agents/NewBalanceIsraelAgent');
const HokaIsraelAgent = require('./agents/HokaIsraelAgent');
const AsicsIsraelAgent = require('./agents/AsicsIsraelAgent');
const SauconyIsraelAgent = require('./agents/SauconyIsraelAgent');
const OnCloudIsraelAgent = require('./agents/OnCloudIsraelAgent');
const WeShoesAgent = require('./agents/WeShoesAgent');

// Default target parameters
let brandInput = 'Nike';
let modelInput = '';
let sizeInput = '*';
let shouldLoadLast = false;

// Parse CLI arguments
const args = process.argv.slice(2);
console.log("DEBUG ARGS:", JSON.stringify(args));

if (args.includes('--load-last')) {
    shouldLoadLast = true;
}

// Known multi-word brands — check longest match first
const MULTI_WORD_BRANDS = [
    'New Balance', 'Under Armour', 'On Cloud', 'ON Running', 'Air Jordan',
    'ON', 'Hoka One One'
];

if (args[0] && !args[0].startsWith('--')) {
    const input = args[0].trim();
    const inputUpper = input.toUpperCase();

    let matched = false;
    // Try multi-word brands first (longest match priority)
    const sortedBrands = [...MULTI_WORD_BRANDS].sort((a, b) => b.length - a.length);
    for (const mb of sortedBrands) {
        if (inputUpper.startsWith(mb.toUpperCase())) {
            brandInput = input.substring(0, mb.length).trim();
            modelInput = input.substring(mb.length).trim();
            matched = true;
            break;
        }
    }

    // Fallback: single first-word split
    if (!matched) {
        const split = input.split(' ');
        brandInput = split[0];
        modelInput = split.slice(1).join(' ');
    }
}
if (args[1] && !args[1].startsWith('--')) {
    sizeInput = args[1];
}

const jsonPath = process.env.EXPORT_JSON || path.join(__dirname, '../frontend/public/data.json');

if (shouldLoadLast) {
    try {
        if (fs.existsSync(jsonPath)) {
            const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

            if (data.scheduledSearchEnabled === false) {
                console.log('⏸ Scheduled search is PAUSED by user. Skipping execution.'.yellow);
                process.exit(0);
            }

            if (data.lastSearchTerm) {
                const termSplit = data.lastSearchTerm.split(' ');
                brandInput = termSplit[0];
                modelInput = termSplit.slice(1).join(' ');
                console.log(`🔄 Loaded last search term: "${data.lastSearchTerm}"`.cyan);
            }
            if (data.lastSizeInput) {
                sizeInput = data.lastSizeInput;
                console.log(`🔄 Loaded last size input: "${data.lastSizeInput}"`.cyan);
            }
        }
    } catch (e) {
        console.error("Failed to load last search:", e.message);
    }
}

async function run() {
    console.log(`\n🚀 Starting Multi-Agent Orchestrator at ${new Date().toLocaleTimeString()}...`.cyan);
    console.log(`🔎 Target: Brand="${brandInput}" Model="${modelInput}" Size="${sizeInput}"`.yellow.bold);

    // Write initial progressive state to notify UI that search started
    const initialState = {
        updatedAt: new Date().toISOString(),
        isRunning: true,
        lastSearchTerm: `${brandInput} ${modelInput}`.trim(),
        lastSizeInput: sizeInput,
        filters: { models: [`${brandInput} ${modelInput}`.trim()], sizes: sizeInput === '*' ? [] : [sizeInput] },
        results: []
    };
    try { fs.writeFileSync(jsonPath, JSON.stringify(initialState, null, 2)); } catch (e) { }

    const orchestrator = new Orchestrator();

    // Register the migrated agents
    orchestrator.registerWorker(new TerminalXAgent());
    orchestrator.registerWorker(new Factory54Agent());
    orchestrator.registerWorker(new LimeShoesAgent());
    orchestrator.registerWorker(new NikeIsraelAgent());
    orchestrator.registerWorker(new AdidasIsraelAgent());
    orchestrator.registerWorker(new FootLockerIsraelAgent());
    orchestrator.registerWorker(new JDSportsAgent());
    orchestrator.registerWorker(new MayersAgent());
    // orchestrator.registerWorker(new KicksAgent());    // Removed: 403 Forbidden

    // orchestrator.registerWorker(new PumaIsraelAgent()); // Removed: il.puma.com store is shut down
    orchestrator.registerWorker(new NewBalanceIsraelAgent());
    orchestrator.registerWorker(new HokaIsraelAgent());
    orchestrator.registerWorker(new AsicsIsraelAgent());
    orchestrator.registerWorker(new SauconyIsraelAgent());
    orchestrator.registerWorker(new OnCloudIsraelAgent());
    orchestrator.registerWorker(new WeShoesAgent());

    const accumulatedResults = [];

    // Listen for progressive item streams
    orchestrator.on('item_found', (item) => {
        accumulatedResults.push(item);
        const itemLabel = (item.display_title || item.title || 'Unknown').substring(0, 30);
        console.log(`   💎 [UI Stream] Received validated item: ${itemLabel} - ₪${item.price_ils}`.green);

        // Update local file for UI polling
        initialState.results = accumulatedResults;
        initialState.updatedAt = new Date().toISOString();
        try { fs.writeFileSync(jsonPath, JSON.stringify(initialState, null, 2)); } catch (e) { }
    });

    // Start pipeline
    await orchestrator.startSearch(brandInput, modelInput, sizeInput);

    // Final state write
    console.log(`\n📊 Total Validated Products Found: ${accumulatedResults.length}`.green.bold);
    initialState.isRunning = false;
    initialState.updatedAt = new Date().toISOString();

    try {
        fs.writeFileSync(jsonPath, JSON.stringify(initialState, null, 2));
        console.log(`\n💾 Saved to ${jsonPath}`.cyan);
    } catch (e) {
        console.error(`❌ Failed to save final payload: ${e.message}`);
    }

    process.exit(0);
}

run();
