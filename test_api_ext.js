const https = require('https');
const fs = require('fs');

console.log("Testing Sneaks-API one more time with a broader search to see if we can get models...");

// Sneaks API uses StockX and FlightClub. To avoid bot blocks, we request generic search terms.
const SneaksAPI = require('sneaks-api');
const sneaks = new SneaksAPI();

const TARGET_BRANDS = ["Nike", "Adidas", "Puma", "New Balance", "Asics", "Hoka", "On Running", "Saucony", "Jordan"];

async function getBrandModels(brand) {
    return new Promise((resolve) => {
        // Limit to 100 to get a good spread of current popular models
        sneaks.getProducts(brand, 100, function (err, products) {
            if (err) {
                console.log(`[Error] sneaks-api failed for ${brand}`);
                resolve([]);
                return;
            }

            // Extract the 'silhoutte' or 'shoeName' and normalize to get the base model
            const models = products.map(p => {
                // Try to use silhouette (e.g. "Air Force 1") instead of full name ("Nike Air Force 1 Low '07 White")
                if (p.silhoutte && p.silhoutte.length > 2) return p.silhoutte.replace(new RegExp(brand, 'i'), '').trim();

                // Fallback to splitting shoeName and taking the first 2-3 words
                const nameWords = p.shoeName.replace(new RegExp(brand, 'i'), '').trim().split(' ');
                return nameWords.slice(0, 3).join(' ');
            }).filter(Boolean);

            // Deduplicate
            const uniqueModels = [...new Set(models)];
            resolve(uniqueModels);
        });
    });
}

async function run() {
    const taxonomy = { brands: [] };
    let total = 0;

    for (const brand of TARGET_BRANDS) {
        console.log(`Fetching live models for ${brand} via sneaks-api...`);
        const models = await getBrandModels(brand);
        console.log(`✅ Found ${models.length} unique models for ${brand}`);
        if (models.length > 0) {
            taxonomy.brands.push({ brand_name: brand, models });
            total += models.length;
        }
        // Rate limit sleep
        await new Promise(r => setTimeout(r, 2000));
    }

    console.log(`\n🎉 Total live models extracted: ${total}`);
    fs.writeFileSync('dynamic_models_test.json', JSON.stringify(taxonomy, null, 2));
}

run();
