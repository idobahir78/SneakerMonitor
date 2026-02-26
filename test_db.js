const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: './frontend/.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'missing';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'missing';

if (supabaseUrl === 'missing') {
    console.log("No .env found in frontend. Cannot test DB directly.");
    // Maybe try root?
    dotenv.config({ path: '.env' });
    if (!process.env.SUPABASE_URL) {
        console.log("Also no .env in root. Please provide ENV.");
        process.exit(1);
    }
}

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, key);

async function check() {
    console.log("Checking search_jobs...");
    const { data: jobs, error: err1 } = await supabase.from('search_jobs').select('*');
    if (err1) console.error("Error jobs:", err1.message);
    else console.log("search_jobs:", jobs);

    console.log("\nChecking products count and unique search_ids...");
    const { data: prods, error: err2 } = await supabase.from('products').select('search_id, model');
    if (err2) console.error("Error prods:", err2.message);
    else {
        console.log(`Total products: ${prods.length}`);
        const searchIds = [...new Set(prods.map(p => p.search_id))];
        console.log("Found search_ids in products:", searchIds);
    }
}

check();
