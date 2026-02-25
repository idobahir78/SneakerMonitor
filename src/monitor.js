const fs = require('fs');
const path = require('path');
const colors = require('colors');
const { createClient } = require('@supabase/supabase-js');

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

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;
const searchId = process.env.SEARCH_ID || 'scheduled_system_run';

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
    if (!supabaseUrl || !supabaseKey) {
        console.warn(`[Audit] Supabase credentials missing. Will skip database operations.`.yellow);
    } else {
        console.log(`[Audit] Supabase connected: ${supabaseUrl.substring(0, 15)}...`);
    }
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

async function updateSystemState(isScanning) {
    if (!supabase) return;
    try {
        await supabase.from('search_jobs').upsert({ id: searchId, is_scanning: isScanning, last_run: new Date().toISOString() });
    } catch (e) {
        console.error('[Supabase] Error updating state:', e.message);
    }
}

async function cleanupOldRecords() {
    if (!supabase) return;
    try {
        // Drop records older than 24 hours to prevent db bloat across all users
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const { error, count } = await supabase
            .from('products')
            .delete({ count: 'exact' })
            .lt('created_at', yesterday.toISOString());

        if (error) throw error;
        if (count > 0) console.log(`[Supabase] Cleaned up ${count} records older than 24h.`);
    } catch (e) {
        console.error('[Supabase] Error cleaning up old records:', e.message);
    }
}

async function saveResultsToSupabase(results, searchBrand, searchModel) {
    if (!supabase || results.length === 0) return;

    // Ensure all required fields exist to prevent DB errors
    const productsToInsert = results.map(item => ({
        search_id: searchId,
        brand: item.brand || searchBrand || 'Unknown',
        model: item.model || searchModel || 'Unknown',
        price: item.price_ils ?? item.price ?? 0,
        site: item.store_name || item.store || 'Unknown',
        image_url: item.image_url || item.image || item.raw_image_url || '',
        product_url: item.buy_link || item.link || item.url || item.raw_url || '',
        sizes: item.sizes || item.raw_sizes || []
    })).filter(p => p.product_url);

    if (productsToInsert.length === 0) return;

    try {
        const { error } = await supabase.from('products').upsert(productsToInsert, { onConflict: 'product_url' });
        if (error) throw error;
        console.log(`[Supabase] Successfully saved ${productsToInsert.length} products to DB.`);
    } catch (e) {
        console.error('[Supabase] Error saving products:', e.message);
    }
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

    await updateSystemState(true);
    await cleanupOldRecords();

    let allResults = [];
    for (const task of searchTasks) {
        const results = await performSearch(task.brand, task.model, task.size);
        await saveResultsToSupabase(results, task.brand, task.model);
        allResults = [...allResults, ...results];

        console.log(`DEBUG: Items passing final size filter: [${results.length}]`);
        if (results.length > 0) {
            console.log(`DEBUG: Starting Telegram notification flow...`);
            await TelegramService.sendNotification(results, task.size);
        }
    }

    await updateSystemState(false);

    // Also save locally as a final fallback for local dev
    const jsonPath = process.env.EXPORT_JSON || path.join(__dirname, '../frontend/public/data.json');
    const dashboardData = {
        lastUpdate: new Date().toISOString(),
        products: allResults,
        isScanning: false,
        scheduledSearchEnabled: true
    };
    try { fs.writeFileSync(jsonPath, JSON.stringify(dashboardData, null, 2)); } catch (e) { }

    console.log(`\n📊 Scanned ${searchTasks.length} tasks. Found ${allResults.length} matches.`.bold.green);
    process.exit(0);
}

run().catch(async err => {
    console.error(`\n❌ Fatal Error: ${err.message}`.red);
    await updateSystemState(false);
    process.exit(1);
});
