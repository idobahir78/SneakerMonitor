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
        const { error } = await supabase.from('products').upsert(productsToInsert, { onConflict: 'product_url, search_id' });
        if (error) throw error;
        console.log(`[Supabase] Successfully saved ${productsToInsert.length} products to DB.`);
    } catch (e) {
        console.error('[Supabase] Error saving products:', e.message);
    }
}

async function runScheduledJobs() {
    if (!supabase) {
        console.error("Supabase not connected. Cannot run scheduled jobs.");
        return;
    }

    try {
        console.log("\n📅 Fetching scheduled search jobs from Supabase...");
        const { data: jobs, error } = await supabase
            .from('search_jobs')
            .select('*')
            .eq('is_scheduled', true);

        if (error) throw error;

        if (!jobs || jobs.length === 0) {
            console.log("No scheduled jobs found today. Exiting.");
            return;
        }

        console.log(`Found ${jobs.length} scheduled jobs to run.`);

        for (const job of jobs) {
            const searchTerm = job.search_term || 'Nike';
            const sizeFilter = job.size_filter || '*';
            const targetSearchId = job.id;

            console.log(`\n================================`);
            console.log(`🏃 Running Scheduled Job for Search ID: ${targetSearchId}`);
            console.log(`Query: "${searchTerm}", Size: "${sizeFilter}"`);
            console.log(`================================`);

            // Use the same extraction logic
            const { brand, model } = parseSearchInput(searchTerm);

            // Mark job as scanning
            await supabase.from('search_jobs').upsert({
                id: targetSearchId,
                is_scanning: true,
                last_run: new Date().toISOString()
            });

            // Execute the heavy scrape
            const results = await performSearch(brand, model, sizeFilter);

            // Wipe old results and save new ones for this specific user
            await supabase.from('products').delete().eq('search_id', targetSearchId);

            const recordsToInsert = results.map(p => ({
                search_id: targetSearchId,
                brand: p.raw_brand,
                model: p.raw_title,
                price: p.raw_price,
                site: p.agent,
                product_url: p.product_url,
                image_url: p.raw_image_url,
                sizes: JSON.stringify(p.raw_sizes)
            }));

            if (recordsToInsert.length > 0) {
                await supabase.from('products').insert(recordsToInsert);
            }

            // Mark job as finished
            await supabase.from('search_jobs').upsert({
                id: targetSearchId,
                is_scanning: false,
                last_run: new Date().toISOString()
            });

            console.log(`✅ Finished Job for ${targetSearchId}. Saved ${recordsToInsert.length} products.`);

            // Short delay between users to avoid hammering local RAM / APIs
            await new Promise(r => setTimeout(r, 5000));
        }

    } catch (e) {
        console.error("Scheduled Run Error:", e.message);
    }
}

// ==========================================
// Execution Control
// ==========================================
(async () => {
    console.log(`\n🚀 Sneaker Monitor v7.0 at ${new Date().toLocaleTimeString()}`.bold.green);
    auditEnv();

    const args = process.argv.slice(2);

    if (args.includes('--run-scheduled')) {
        await runScheduledJobs();
        process.exit(0);
    }

    const isLoadLast = args.includes('--load-last');

    // We already do a Supabase update in a user-triggered flow handled below:
    let searchInputDisplay = '';
    let sizeFilter = '*';

    if (isLoadLast && supabase) {
        console.log('Fetching last manual query from system...'.cyan);
        const { data } = await supabase.from('search_jobs').select('*').eq('id', searchId).single();
        if (data && data.search_term) {
            searchInputDisplay = data.search_term;
            if (data.size_filter) sizeFilter = data.size_filter;
        } else {
            searchInputDisplay = "Nike Dunk";
        }
    } else {
        searchInputDisplay = args[0] || "Nike Dunk";
        sizeFilter = args[1] || "*";
    }

    await updateSystemState(true);

    const { brand, model } = parseSearchInput(searchInputDisplay);
    const results = await performSearch(brand, model, sizeFilter);

    // Save directly to Supabase for the manual invoker
    if (supabase) {
        console.log(`[Supabase] Deleting old records for search_id: ${searchId}...`.yellow);
        await supabase.from('products').delete().eq('search_id', searchId);

        console.log(`[Supabase] Inserting ${results.length} new records for ${searchId}...`.green);
        const recordsToInsert = results.map(p => ({
            search_id: searchId,
            brand: p.raw_brand,
            model: p.raw_title,
            price: p.raw_price,
            site: p.agent,
            product_url: p.product_url,
            image_url: p.raw_image_url,
            sizes: JSON.stringify(p.raw_sizes)
        }));

        if (recordsToInsert.length > 0) {
            const { error } = await supabase.from('products').insert(recordsToInsert);
            if (error) console.error('[Supabase] Insert Error:', error.message);
        }

        // Also update their search_term if they triggered it manually so it acts as their "last search"
        await supabase.from('search_jobs').upsert({
            id: searchId,
            is_scanning: false,
            last_run: new Date().toISOString(),
            search_term: searchInputDisplay,
            size_filter: sizeFilter
        });
    }

    try {
        const telegram = new TelegramService();
        await telegram.sendSummary(results);
    } catch (e) {
        console.error(`[Telegram] Failed: ${e.message}`.red);
    }

    console.log(`\n📊 Scanned tasks. Found ${results.length} matches.`.bold.green);
    process.exit(0);
})();


