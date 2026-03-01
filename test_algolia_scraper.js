const https = require('https');
const fs = require('fs');
const path = require('path');

const TARGET_BRANDS = ["Nike", "Adidas", "Puma", "New Balance", "Asics", "Hoka", "On Running", "Saucony", "Jordan"];

console.log("Testing dynamic extraction from GOAT Algolia API...");

async function fetchBrandModels(brand) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            requests: [
                {
                    indexName: 'product_variants_v2',
                    params: `query=${encodeURIComponent(brand)}&hitsPerPage=100&facetFilters=[["brand_name:${brand.toLowerCase()}","brand_name:${brand}"]]`
                }
            ]
        });

        const options = {
            hostname: '2fwotdvm2o-dsn.algolia.net',
            path: '/1/indexes/*/queries?x-algolia-application-id=2FWOTDVM2O&x-algolia-api-key=ac96de6fef0e02bb95d433d8d5c7038a',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/119.0.0.0 Safari/537.36'
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const json = JSON.parse(body);
                        const hits = json.results[0].hits;

                        // Extract base models
                        let models = hits.map(hit => hit.silhouette)
                            .filter(Boolean)
                            .map(m => m.trim());

                        // Deduplicate
                        models = [...new Set(models)];
                        resolve(models);
                    } catch (e) {
                        reject(e);
                    }
                } else {
                    reject(new Error(`API Error: ${res.statusCode} ${body.substring(0, 50)}`));
                }
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function run() {
    const taxonomy = { brands: [] };
    let total = 0;

    for (const brand of TARGET_BRANDS) {
        try {
            console.log(`Fetching models for ${brand}...`);
            const models = await fetchBrandModels(brand);
            console.log(`✅ Found ${models.length} silhouttes for ${brand}`);

            if (models.length > 0) {
                taxonomy.brands.push({ brand_name: brand, models: models });
                total += models.length;
            }

            // Wait to avoid rate limit
            await new Promise(r => setTimeout(r, 1000));
        } catch (e) {
            console.error(`❌ Failed for ${brand}: ${e.message}`);
        }
    }

    console.log(`\n🎉 Total dynamic models extracted: ${total}`);
    if (total > 0) {
        fs.writeFileSync('dynamic_models_test.json', JSON.stringify(taxonomy, null, 2));
        console.log("Saved to dynamic_models_test.json");
    }
}

run();
