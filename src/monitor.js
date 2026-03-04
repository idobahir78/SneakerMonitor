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
const MayersAgent = require('./agents/MayersAgent');
// JDSportsAgent removed – JD Sports confirmed closing Israeli operations (Jan 2026)
// KicksAgent removed – site defunct (SSL error + persistent 403)
const NewBalanceIsraelAgent = require('./agents/NewBalanceIsraelAgent');
const HokaIsraelAgent = require('./agents/HokaIsraelAgent');
const AsicsIsraelAgent = require('./agents/AsicsIsraelAgent');
const SauconyIsraelAgent = require('./agents/SauconyIsraelAgent');
const OnCloudIsraelAgent = require('./agents/OnCloudIsraelAgent');
const WeShoesAgent = require('./agents/WeShoesAgent');
const SportLibermanAgent = require('./agents/SportLibermanAgent');
const SneakersOnlineAgent = require('./agents/SneakersOnlineAgent');
const TelegramService = require('./services/TelegramService');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;
const searchId = process.env.SEARCH_ID || 'scheduled_system_run';

const MULTI_WORD_BRANDS = [
    'New Balance', 'Under Armour', 'ON Running', 'Air Jordan',
    'On Cloud'
    // 'Hoka One One' removed – brand is officially 'Hoka' since 2019
];

/**
 * Converts a string to Title Case.
 * e.g. "new balance" → "New Balance", "stan smith" → "Stan Smith"
 * Preserves known all-caps tokens like "OG", "XL", "LO", "PRO".
 */
function toTitleCase(str) {
    if (!str) return str;
    const KEEP_UPPER = new Set(['OG', 'XL', 'LO', 'PRO', 'GTX', 'GTX+', 'SP', 'II', 'III', 'IV', 'VI', 'VII']);
    return str.trim().split(/\s+/).map(word => {
        if (KEEP_UPPER.has(word.toUpperCase())) return word.toUpperCase();
        // Preserve product codes like MB.05, GT-2000, P-6000 (all-caps + contains digit or dot/hyphen)
        if (/^[A-Z0-9][A-Z0-9.\-]+$/.test(word) && /\d/.test(word)) return word.toUpperCase();
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
}

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
            // Use the canonical casing from MULTI_WORD_BRANDS (already correct)
            const canonicalBrand = normalizeBrand(mb);
            const rawModel = inputTrimmed.substring(mb.length).trim();
            const model = toTitleCase(rawModel);
            return { brand: canonicalBrand, model };
        }
    }

    // Single-word brand: apply title case to both brand and model
    const split = inputTrimmed.split(/\s+/);
    const brand = normalizeBrand(toTitleCase(split[0]));
    const model = toTitleCase(split.slice(1).join(' '));
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
    orchestrator.registerWorker(new MayersAgent());
    orchestrator.registerWorker(new NewBalanceIsraelAgent());
    orchestrator.registerWorker(new HokaIsraelAgent());
    orchestrator.registerWorker(new AsicsIsraelAgent());
    orchestrator.registerWorker(new SauconyIsraelAgent());
    orchestrator.registerWorker(new OnCloudIsraelAgent());
    orchestrator.registerWorker(new WeShoesAgent());
    orchestrator.registerWorker(new SportLibermanAgent());
    orchestrator.registerWorker(new SneakersOnlineAgent());

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
                brand: p.brand || brand || 'Unknown',
                model: p.display_title || p.model || model || 'Unknown',
                price: p.price_ils || p.price || 0,
                site: p.store_name || p.store || p.agent || 'Unknown',
                product_url: p.buy_link || p.link || p.product_url || '',
                image_url: p.image_url || p.raw_image_url || '',
                sizes: JSON.stringify(p.sizes || p.raw_sizes || [])
            }));

            if (recordsToInsert.length > 0) {
                await supabase.from('products').insert(recordsToInsert);

                // --- SMART LEARNING: Save newly verified models ---
                try {
                    const insertBrand = brand || 'Unknown';
                    const insertModel = model || searchTerm.replace(new RegExp(`^${insertBrand}\\s`, 'i'), '').trim();
                    if (insertBrand !== 'Unknown' && insertModel !== '') {
                        console.log(`[Smart Learning] Saving verified model "${insertBrand} ${insertModel}" to custom_taxonomy.`);
                        await supabase.from('custom_taxonomy').upsert(
                            { brand: insertBrand, model: insertModel },
                            { onConflict: 'brand, model' }
                        );
                    }
                } catch (e) {
                    console.error('[Smart Learning] Failed:', e.message);
                }
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
            brand: p.brand || brand || 'Unknown',
            model: p.display_title || p.model || model || 'Unknown',
            price: p.price_ils || p.price || 0,
            site: p.store_name || p.store || p.agent || 'Unknown',
            product_url: p.buy_link || p.link || p.product_url || '',
            image_url: p.image_url || p.raw_image_url || '',
            sizes: JSON.stringify(p.sizes || p.raw_sizes || [])
        }));

        // Deduplicate by product_url to avoid "ON CONFLICT DO UPDATE cannot affect row a second time"
        // (can happen when the same URL appears multiple times in results, e.g. NB Israel men/women variants)
        const seenUrls = new Set();
        const dedupedRecords = recordsToInsert.filter(r => {
            if (!r.product_url || seenUrls.has(r.product_url)) return false;
            seenUrls.add(r.product_url);
            return true;
        });

        if (dedupedRecords.length > 0) {
            const { error } = await supabase.from('products').upsert(dedupedRecords, { onConflict: 'product_url, search_id' });
            if (error) console.error('[Supabase] Upsert Error:', error.message);

            // --- SMART LEARNING: Save newly verified models ---
            try {
                const insertBrand = brand || 'Unknown';
                const insertModel = model || searchInputDisplay.replace(new RegExp(`^${insertBrand}\\s`, 'i'), '').trim();
                if (insertBrand !== 'Unknown' && insertModel !== '') {
                    console.log(`\n[Smart Learning] Found verified results! Merging "${insertBrand} ${insertModel}" into global taxonomy...`.cyan);
                    const { error: customErr } = await supabase.from('custom_taxonomy').upsert(
                        { brand: insertBrand, model: insertModel },
                        { onConflict: 'brand, model' }
                    );
                    if (customErr) console.error('[Smart Learning] Upsert Error:', customErr.message);
                }
            } catch (e) {
                console.error('[Smart Learning] Failed:', e.message);
            }
        }

        try {
            // Also update their search_term if they triggered it manually so it acts as their "last search"
            await supabase.from('search_jobs').upsert({
                id: searchId,
                is_scanning: false,
                last_run: new Date().toISOString(),
                search_term: searchInputDisplay,
                size_filter: sizeFilter
            });
        } catch (e) {
            console.error('[Supabase] Error saving manual search job state:', e.message);
        }
    }

    try {
        const telegram = new TelegramService();
        await telegram.sendNotification(results, sizeFilter);
    } catch (e) {
        console.error(`[Telegram] Failed: ${e.message}`.red);
    }

    console.log(`\n📊 Scanned tasks. Found ${results.length} matches.`.bold.green);
    process.exit(0);
})();


