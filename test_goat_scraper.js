const https = require('https');
const fs = require('fs');
const path = require('path');

const TARGET_BRANDS = ["Nike", "Adidas", "Puma", "New Balance", "Asics", "Hoka", "On Running", "Saucony", "Jordan"];

console.log("Checking Goat's Product API for comprehensive models...");

async function fetchGoatModels(brand) {
    return new Promise((resolve, reject) => {
        // Query Algolia index broadly for the brand
        const data = JSON.stringify({
            requests: [
                {
                    indexName: 'product_variants_v2',
                    // We pull 500 hits to get a massive variety of models (limit per page usually 1000)
                    params: `query=${encodeURIComponent(brand)}&hitsPerPage=500&facetFilters=[["brand_name:${brand.toLowerCase()}","brand_name:${brand}"]]`
                }
            ]
        });

        const options = {
            hostname: '2fwotdvm2o-dsn.algolia.net',
            path: '/1/indexes/*/queries?x-algolia-application-id=2FWOTDVM2O&x-algolia-api-key=ac96de6fef0e02bb95d433d8d5c7038a',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
                'User-Agent': 'Mozilla/5.0'
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

                        // "silhouette" field contains the exact base model name in GOAT
                        let models = hits.map(hit => hit.silhouette)
                            .filter(Boolean)
                            .map(m => m.trim());

                        models = [...new Set(models)];
                        resolve(models);
                    } catch (e) {
                        reject(e);
                    }
                } else {
                    reject(new Error(`API Error: ${res.statusCode}`));
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
            console.log(`Fetching GOAT models for ${brand}...`);
            const models = await fetchGoatModels(brand);
            console.log(`✅ Found ${models.length} definitive silhouettes for ${brand}`);

            // Check if specific missing models are caught
            if (brand === 'Nike') {
                console.log("Does Nike have Kobe?", models.some(m => m.toLowerCase().includes('kobe')));
                console.log("Does Nike have KD?", models.some(m => m.toLowerCase().includes('kd')));
            }
            if (brand === 'Puma') {
                console.log("Does Puma have MB series?", models.some(m => m.toLowerCase().includes('mb.0')));
            }

            if (models.length > 0) {
                taxonomy.brands.push({ brand_name: brand, models: models.sort() });
                total += models.length;
            }

            await new Promise(r => setTimeout(r, 1000));
        } catch (e) {
            console.error(`❌ Failed for ${brand}: ${e.message}`);
        }
    }

    console.log(`\n🎉 Total GOAT dynamic models extracted: ${total}`);
}

run();
