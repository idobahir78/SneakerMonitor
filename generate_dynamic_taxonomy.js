const fs = require('fs');
const path = require('path');
const { scrapeOfficialSites } = require('./src/scrapers/official_sites');

const JSON_PATH = path.join(__dirname, 'frontend', 'src', 'data', 'sneaker_models.json');

console.log("🚀 Starting 100% Deterministic Sneaker Taxonomy Generator (Playwright Only)...");

async function generateDeterministicTaxonomy() {
    const taxonomy = { brands: [] };
    let total = 0;

    // Execute Playwright Scraper on First-Party Sites
    let firstPartyModels = {};
    try {
        firstPartyModels = await scrapeOfficialSites();
    } catch (e) {
        console.error("Playwright Scraper Error:", e.message);
    }

    for (const [brand, models] of Object.entries(firstPartyModels)) {
        if (models && models.length > 0) {
            let sortedModels = models.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
            taxonomy.brands.push({ brand_name: brand, models: sortedModels });
            total += models.length;
            console.log(`✅ Appended Pure-Playwright brand: ${brand} (${models.length} models)`);
        }
    }

    // Sort array of brand objects alphabetically
    taxonomy.brands.sort((a, b) => a.brand_name.localeCompare(b.brand_name));

    const dir = path.dirname(JSON_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(JSON_PATH, JSON.stringify(taxonomy, null, 2), 'utf-8');

    console.log(`\n🎯 Successfully compiled Deterministic Sneaker Taxonomy!`);
    console.log(`📊 Total guaranteed live models extracted: ${total}`);
}

generateDeterministicTaxonomy();
