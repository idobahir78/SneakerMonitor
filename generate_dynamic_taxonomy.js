const https = require('https');
const fs = require('fs');
const path = require('path');

const WIKIPEDIA_PAGES = {
    'Nike': ['List_of_Nike_apparel_and_equipment'],
    'Adidas': ['List_of_Adidas_sponsorships'],
    'New Balance': ['New_Balance'],
    'Asics': ['Asics'],
    'Puma': ['Puma_(brand)'],
    'Saucony': ['Saucony'],
    'Air Jordan': ['Air_Jordan'],
    'Hoka': ['Hoka_One_One'],
    'On Running': ['On_(company)']
};

const JSON_PATH = path.join(__dirname, 'frontend', 'src', 'data', 'sneaker_models.json');

console.log("🚀 Starting Dynamic Sneaker Taxonomy Generator (Wikipedia Source)...");

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

function cleanHtmlText(text) {
    return text.replace(/<[^>]*>?/gm, '') // Remove HTML
        .replace(/\[\d+\]/g, '')   // Remove citations like [1]
        .replace(/&#160;/g, ' ')   // Remove non-breaking spaces
        .trim();
}

function isLikelySneakerModel(text, brand) {
    if (text.length < 3 || text.length > 30) return false;
    if (text.toLowerCase().includes('redirect')) return false;
    if (text.toLowerCase().includes('category')) return false;
    if (text.toLowerCase().includes('external links')) return false;
    if (text.toLowerCase().includes('references')) return false;
    if (text.includes('://')) return false;

    // Most models are alphanumeric with spaces, sometimes hyphens or dots
    if (!/^[a-zA-Z0-9\s-.]+$/.test(text)) return false;

    return true;
}

function extractModelsFromHTML(html, brand) {
    const models = new Set();

    // 1. Look for list items
    const liMatches = html.match(/<li>(.*?)<\/li>/g) || [];
    liMatches.forEach(li => {
        let text = cleanHtmlText(li);

        // Strip brand prefix if exists
        const brandRegex = new RegExp(`^${brand}\\s+`, 'i');
        text = text.replace(brandRegex, '').trim();

        if (isLikelySneakerModel(text, brand)) {
            models.add(text);
        }
    });

    // 2. Look for bolded terms (often used for product lines)
    const bMatches = html.match(/<b>(.*?)<\/b>/g) || [];
    bMatches.forEach(b => {
        let text = cleanHtmlText(b);
        const brandRegex = new RegExp(`^${brand}\\s+`, 'i');
        text = text.replace(brandRegex, '').trim();

        if (isLikelySneakerModel(text, brand)) {
            models.add(text);
        }
    });

    return Array.from(models);
}

// In case Wikipedia doesn't have enough for a specific brand, we merge with a solid core foundation
const CORE_FOUNDATION = {
    "Nike": ["Air Force 1", "Dunk Low", "Air Max 90", "Air Max 95", "Blazer Mid"],
    "Adidas": ["Ultraboost", "Yeezy Boost 350", "Stan Smith", "Superstar", "Samba"],
    "Puma": ["Suede", "RS-X", "Clyde", "MB.01", "MB.02", "MB.03"],
    "New Balance": ["990", "2002R", "550", "327", "993"],
    "Asics": ["Gel-Kayano", "Gel-Nimbus", "Gel-Lyte III", "Metaspeed"],
    "Hoka": ["Clifton", "Bondi", "Speedgoat", "Mach", "Arahi"],
    "On Running": ["Cloud", "Cloudmonster", "Cloudflow", "Cloudswift"],
    "Saucony": ["Kinvara", "Endorphin Pro", "Ride", "Jazz", "Triumph"],
    "Air Jordan": ["1 Retro High", "3 Retro", "4 Retro", "11 Retro"]
};


async function generateDynamicTaxonomy() {
    const taxonomy = { brands: [] };
    let total = 0;

    for (const [brand, pages] of Object.entries(WIKIPEDIA_PAGES)) {
        let brandModels = new Set(CORE_FOUNDATION[brand] || []);

        console.log(`\n🔍 Scanning dynamic sources for ${brand}...`);
        for (const page of pages) {
            const html = await fetchWikipediaHtml(page);
            if (html) {
                const extracted = extractModelsFromHTML(html, brand);
                extracted.forEach(m => brandModels.add(m));
            }
        }

        let modelsArray = Array.from(brandModels).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        console.log(`✅ Extracted & Merged ${modelsArray.length} models for ${brand}`);

        if (modelsArray.length > 0) {
            taxonomy.brands.push({ brand_name: brand, models: modelsArray });
            total += modelsArray.length;
        }

        // Politeness delay
        await new Promise(r => setTimeout(r, 1000));
    }

    // Ensure directories exist
    const dir = path.dirname(JSON_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(JSON_PATH, JSON.stringify(taxonomy, null, 2), 'utf-8');

    console.log(`\n🎯 Successfully compiled Dynamic Sneaker Taxonomy!`);
    console.log(`📊 Total dynamic models extracted across all brands: ${total}`);
    console.log(`📁 File saved directly to UI: ${JSON_PATH}`);
}

generateDynamicTaxonomy();
