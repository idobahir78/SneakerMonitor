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

function auditEnv() {
    const token = process.env.TELEGRAM_BOT_TOKEN || '';
    const chat = process.env.TELEGRAM_CHAT_ID || '';
    const obsToken = token ? `${token.substring(0, 4)}...xxxx` : 'MISSING';
    const obsChat = chat ? `${chat.substring(0, 4)}...xxxx` : 'MISSING';
    console.log(`[Audit] Telegram Token: ${obsToken}, Chat ID: ${obsChat}`);
}

async function performSearch(brand, model, size) {
    console.log(`\n🔎 Running: Brand="${brand}" Model="${model}" Size="${size}"`.cyan);
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

    await orchestrator.startSearch(brand, model, size);
    return orchestrator.results;
}

function updateState(allResults, isScanning) {
    const jsonPath = process.env.EXPORT_JSON || path.join(__dirname, '../frontend/public/data.json');
    let existingData = {};
    if (fs.existsSync(jsonPath)) {
        try { existingData = JSON.parse(fs.readFileSync(jsonPath, 'utf8')); } catch (e) { }
    }

    const dashboardData = {
        ...existingData,
        lastUpdate: new Date().toISOString(),
        products: isScanning ? (existingData.products || []) : allResults,
        isScanning: isScanning,
        scheduledSearchEnabled: true
    };
    fs.writeFileSync(jsonPath, JSON.stringify(dashboardData, null, 2));
}

async function run() {
    console.log(`\n🚀 Sneaker Monitor v7.0 at ${new Date().toLocaleTimeString()}`.bold.green);
    auditEnv();

    const args = process.argv.slice(2);
    let searchTasks = [];

    if (args[0] && !args[0].startsWith('--')) {
        const { brand, model } = parseSearchInput(args[0]);
        const size = (args[1] && !args[1].startsWith('--')) ? args[1] : '*';
        searchTasks.push({ brand, model, size });
    } else {
        const watchPath = path.join(__dirname, '../watchlist.json');
        if (fs.existsSync(watchPath)) {
            console.log(`📋 Loading Watchlist from ${watchPath}`.cyan);
            searchTasks = JSON.parse(fs.readFileSync(watchPath, 'utf8'));
        } else {
            console.log(`⚠️ No input and no watchlist.json found.`.yellow);
            process.exit(0);
        }
    }

    updateState([], true);

    let allResults = [];
    for (const task of searchTasks) {
        const results = await performSearch(task.brand, task.model, task.size);
        allResults = [...allResults, ...results];

        console.log(`DEBUG: Items passing final size filter: [${results.length}]`);
        if (results.length > 0) {
            console.log(`DEBUG: Starting Telegram notification flow...`);
            await TelegramService.sendNotification(results, task.size);
        }
    }

    updateState(allResults, false);

    console.log(`\n📊 Scanned ${searchTasks.length} tasks. Found ${allResults.length} matches.`.bold.green);
    process.exit(0);
}

run().catch(err => {
    console.error(`\n❌ Fatal Error: ${err.message}`.red);
    updateState([], false);
    process.exit(1);
});
