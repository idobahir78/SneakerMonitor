const https = require('https');
const fs = require('fs');

const wikipediaPages = {
    'Nike': ['List_of_Nike_apparel_and_equipment', 'Nike,_Inc.'],
    'Adidas': ['Adidas'],
    'New Balance': ['New_Balance'],
    'Asics': ['Asics'],
    'Puma': ['Puma_(brand)'],
    'Saucony': ['Saucony'],
    'Jordan': ['Air_Jordan'],
    'Hoka': ['Hoka_One_One'],
    'On Running': ['On_(company)']
};

console.log("Starting reliable, block-free Wikipedia extraction...");

function fetchWikipediaHtml(pageTitle) {
    return new Promise((resolve) => {
        const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${pageTitle}&format=json&prop=text`;
        https.get(url, { headers: { 'User-Agent': 'SneakerMonitor/1.0' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json.parse && json.parse.text ? json.parse.text['*'] : "");
                } catch {
                    resolve("");
                }
            });
        }).on('error', () => resolve(""));
    });
}

function extractModelsFromHTML(html, brand) {
    const models = new Set();

    // Most models are listed in bullet points <li>...</li>
    const liMatches = html.match(/<li>(.*?)<\/li>/g) || [];

    liMatches.forEach(li => {
        // Strip HTML tags
        let text = li.replace(/<[^>]*>?/gm, '').trim();

        // Basic cleaning
        // Ignore very long list items (probably sentences), or items that don't look like product names
        if (text.length > 5 && text.length < 30 && !text.includes('redirect')) {
            // If it starts with the brand name, strip it so we just have the model (e.g. "Nike Air Force 1" -> "Air Force 1")
            const brandRegex = new RegExp(`^${brand}\\s+`, 'i');
            text = text.replace(brandRegex, '').trim();

            // If the remaining text looks like a valid model name (mostly alphanumeric)
            if (/^[a-zA-Z0-9\s-]+$/.test(text)) {
                models.add(text);
            }
        }
    });

    // Also test looking for bold text which is often used for product series
    const bMatches = html.match(/<b>(.*?)<\/b>/g) || [];
    bMatches.forEach(b => {
        let text = b.replace(/<[^>]*>?/gm, '').trim();
        if (text.length > 3 && text.length < 25 && /^[a-zA-Z0-9\s-]+$/.test(text)) {
            const brandRegex = new RegExp(`^${brand}\\s+`, 'i');
            text = text.replace(brandRegex, '').trim();
            models.add(text);
        }
    });

    return Array.from(models);
}

async function run() {
    const taxonomy = { brands: [] };
    let total = 0;

    for (const [brand, pages] of Object.entries(wikipediaPages)) {
        let brandModels = new Set();

        for (const page of pages) {
            console.log(`Fetching Wikipedia page for ${brand}: ${page}...`);
            const html = await fetchWikipediaHtml(page);
            if (html) {
                const extracted = extractModelsFromHTML(html, brand);
                extracted.forEach(m => brandModels.add(m));
            }
        }

        const modelsArray = Array.from(brandModels);
        console.log(`✅ Extracted ${modelsArray.length} potential models for ${brand}`);

        if (modelsArray.length > 0) {
            // Sort alphabetically to be nice
            modelsArray.sort();
            taxonomy.brands.push({ brand_name: brand, models: modelsArray });
            total += modelsArray.length;
        }
        await new Promise(r => setTimeout(r, 500)); // Be nice to Wikipedia API
    }

    console.log(`\n🎉 Total models extracted from Wikipedia: ${total}`);
    fs.writeFileSync('dynamic_wikipedia_models.json', JSON.stringify(taxonomy, null, 2));
    console.log("Check dynamic_wikipedia_models.json");
}

run();
