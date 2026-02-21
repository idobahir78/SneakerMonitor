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

const NewBalanceIsraelAgent = require('./agents/NewBalanceIsraelAgent');
const HokaIsraelAgent = require('./agents/HokaIsraelAgent');
const AsicsIsraelAgent = require('./agents/AsicsIsraelAgent');
const SauconyIsraelAgent = require('./agents/SauconyIsraelAgent');
const OnCloudIsraelAgent = require('./agents/OnCloudIsraelAgent');
const WeShoesAgent = require('./agents/WeShoesAgent');
const TelegramService = require('./services/TelegramService');

let brandInput = 'Nike';
let modelInput = '';
let sizeInput = '*';
let shouldLoadLast = false;

const args = process.argv.slice(2);

if (args.includes('--load-last')) {
    shouldLoadLast = true;
}

const MULTI_WORD_BRANDS = [
    'New Balance', 'Under Armour', 'ON Running', 'Air Jordan',
    'On Cloud', 'Hoka One One'
];

function normalizeBrand(brand) {
    const b = brand.toUpperCase();
    if (b === 'ON CLOUD' || b === 'ON RUNNING' || b === 'ON') return 'ON';
    return brand;
}

function parseSearchInput(input) {
    if (!input) return { brand: 'Nike', model: '' };

    const inputTrimmed = input.trim();
    const inputUpper = inputTrimmed.toUpperCase();

    const sortedBrands = [...MULTI_WORD_BRANDS].sort((a, b) => b.length - a.length);
    for (const mb of sortedBrands) {
        if (inputUpper.startsWith(mb.toUpperCase())) {
            const brand = normalizeBrand(inputTrimmed.substring(0, mb.length).trim());
            const model = inputTrimmed.substring(mb.length).trim();
            return { brand, model };
        }
    }

    const split = inputTrimmed.split(' ');
    const brand = normalizeBrand(split[0]);
    const model = split.slice(1).join(' ');
    return { brand, model };
}

if (args[0] && !args[0].startsWith('--')) {
    const { brand, model } = parseSearchInput(args[0]);
    brandInput = brand;
    modelInput = model;
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
                const { brand, model } = parseSearchInput(data.lastSearchTerm);
                brandInput = brand;
                modelInput = model;
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
    console.log(`\n🚀 Starting Multi-Agent Orchestrator at ${new Date().toLocaleTimeString()}...`.bold.green);
    console.log(`🔎 Target: Brand="${brandInput}" Model="${modelInput}" Size="${sizeInput}"`.cyan);

    const orchestrator = new Orchestrator();

    orchestrator.registerWorker(new TerminalXAgent());
    orchestrator.registerWorker(new Factory54Agent());
    orchestrator.registerWorker(new LimeShoesAgent());
    orchestrator.registerWorker(new NikeIsraelAgent());
    orchestrator.registerWorker(new AdidasIsraelAgent());
    orchestrator.registerWorker(new FootLockerIsraelAgent());
    orchestrator.registerWorker(new JDSportsAgent());
    orchestrator.registerWorker(new MayersAgent());
    orchestrator.registerWorker(new KicksAgent());
    orchestrator.registerWorker(new NewBalanceIsraelAgent());
    orchestrator.registerWorker(new HokaIsraelAgent());
    orchestrator.registerWorker(new AsicsIsraelAgent());
    orchestrator.registerWorker(new SauconyIsraelAgent());
    orchestrator.registerWorker(new OnCloudIsraelAgent());
    orchestrator.registerWorker(new WeShoesAgent());

    await orchestrator.startSearch(brandInput, modelInput, sizeInput);
    const results = orchestrator.results;

    const dashboardData = {
        lastUpdate: new Date().toISOString(),
        lastSearchTerm: `${brandInput} ${modelInput}`.trim(),
        lastSizeInput: sizeInput,
        products: results,
        scheduledSearchEnabled: true
    };

    fs.writeFileSync(jsonPath, JSON.stringify(dashboardData, null, 2));
    console.log(`\n📊 Total Validated Products Found: ${results.length}`.bold.green);
    console.log(`💾 Saved to ${jsonPath}`.gray);

    if (results.length > 0) {
        await TelegramService.sendNotification(results, sizeInput);
    }

    process.exit(0);
}

run().catch(err => {
    console.error(`\n❌ Fatal Error: ${err.message}`.red);
    process.exit(1);
});
