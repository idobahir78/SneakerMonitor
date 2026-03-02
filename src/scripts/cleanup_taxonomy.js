/**
 * cleanup_taxonomy.js
 * Removes duplicate / wrong-case model entries from custom_taxonomy.
 * Run once: node src/scripts/cleanup_taxonomy.js
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    // Delete any entry where model matches wrong-case pattern for MB series
    // (e.g. "Mb.05", "Mb.04", etc.)
    const { data, error } = await supabase
        .from('custom_taxonomy')
        .delete()
        .ilike('model', 'mb.%')  // matches Mb.05, mb.05, etc.
        .not('model', 'ilike', 'MB.%'.toLowerCase()); // keep only exact upper MB.XX

    // Simpler: just delete exact bad entries we know about
    const badModels = ['Mb.05', 'Mb.04', 'Mb.03', 'Mb.02', 'Mb.01', 'mb.05', 'mb.04', 'mb.03', 'mb.02', 'mb.01'];

    for (const model of badModels) {
        const { error: delErr, count } = await supabase
            .from('custom_taxonomy')
            .delete({ count: 'exact' })
            .eq('brand', 'Puma')
            .eq('model', model);

        if (delErr) {
            console.error(`Error deleting ${model}:`, delErr.message);
        } else {
            console.log(`Deleted ${count ?? 0} row(s) for model: "${model}"`);
        }
    }

    console.log('\nDone! custom_taxonomy cleaned up.');
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
