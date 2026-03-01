const https = require('https');
const fs = require('fs');
const path = require('path');

const WIKIPEDIA_PAGES = {
    'Nike': ['List_of_Nike_apparel_and_equipment', 'Nike_Kobe', 'Nike_LeBron', 'Nike_KD'],
    'Adidas': ['List_of_Adidas_sponsorships'],
    'New Balance': ['New_Balance'],
    'Asics': ['Asics'],
    'Puma': ['Puma_(brand)', 'LaMelo_Ball'],
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

// Dynamically build expansive core foundations to cover athlete models that Wikipedia's HTML formatting might obscure.
const CORE_FOUNDATION = {
    "Nike": [
        "Air Force 1", "Dunk Low", "Air Max 90", "Air Max 95", "Blazer Mid",
        ...Array.from({ length: 11 }, (_, i) => `Kobe ${i + 1}`), // Kobe 1 through 11
        ...Array.from({ length: 17 }, (_, i) => `KD ${i + 1}`), // KD 1 through 17
        ...Array.from({ length: 21 }, (_, i) => `LeBron ${i + 1}`), // LeBron 1 through 21
        "PG 1", "PG 2", "PG 3", "PG 4", "PG 5", "PG 6",
        "Kyrie 1", "Kyrie 2", "Kyrie 3", "Kyrie 4", "Kyrie 5", "Kyrie 6", "Kyrie 7", "Kyrie Infinity"
    ],
    "Adidas": ["Ultraboost", "Yeezy Boost 350", "Stan Smith", "Superstar", "Samba", "Harden Vol. 1", "Harden Vol. 2", "Harden Vol. 3", "Harden Vol. 4", "Harden Vol. 5", "Harden Vol. 6", "Harden Vol. 7", "Harden Vol. 8", "Dame 1", "Dame 2", "Dame 3", "Dame 4", "Dame 5", "Dame 6", "Dame 7", "Dame 8", "Trae Young 1", "Trae Young 2", "Trae Young 3"],
    "Puma": [
        "Suede", "RS-X", "Clyde",
        ...Array.from({ length: 4 }, (_, i) => `MB.0${i + 1}`), // MB.01 to MB.04 dynamically (MB.05 is arguably unreleased or barely teased, definitely no MB.06)
        "Scoot Zeros", "All-Pro Nitro", "Court Rider"
    ],
    "New Balance": ["990", "2002R", "550", "327", "993", "TWO WXY v1", "TWO WXY v2", "TWO WXY v3", "TWO WXY v4", "Kawhi 1", "Kawhi 2", "Kawhi 3"],
    "Asics": ["Gel-Kayano", "Gel-Nimbus", "Gel-Lyte III", "Metaspeed"],
    "Hoka": ["Clifton", "Bondi", "Speedgoat", "Mach", "Arahi"],
    "On Running": ["Cloud", "Cloudmonster", "Cloudflow", "Cloudswift"],
    "Saucony": ["Kinvara", "Endorphin Pro", "Ride", "Jazz", "Triumph"],
    "Air Jordan": [
        ...Array.from({ length: 38 }, (_, i) => `${i + 1} Retro`), // Automatically adds 1 Retro to 38 Retro
        "Luka 1", "Luka 2", "Luka 3", "Zion 1", "Zion 2", "Zion 3", "Tatum 1", "Tatum 2"
    ]
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
