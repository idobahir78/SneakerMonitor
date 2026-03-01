const https = require('https');
const fs = require('fs');
const path = require('path');
const { scrapeOfficialSites } = require('./src/scrapers/official_sites');

const WIKIPEDIA_PAGES = {
    'Nike': ['List_of_Nike_apparel_and_equipment', 'Nike_Kobe', 'Nike_LeBron', 'Nike_KD'],
    'Adidas': ['List_of_Adidas_sponsorships'],
    'New Balance': ['New_Balance'],
    'Asics': ['Asics'],
    'Puma': ['Puma_(brand)', 'LaMelo_Ball', 'Breanna_Stewart'],
    'Saucony': ['Saucony'],
    'Air Jordan': ['Air_Jordan'],
    'Hoka': ['Hoka_One_One'],
    'On Running': ['On_(company)']
};

const JSON_PATH = path.join(__dirname, 'frontend', 'src', 'data', 'sneaker_models.json');

console.log("🚀 Starting 100% Dynamic Sneaker Taxonomy Generator (Hybrid Source)...");

function fetchWikipediaHtml(pageTitle) {
    return new Promise((resolve) => {
        const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${pageTitle}&format=json&prop=text`;
        https.get(url, { headers: { 'User-Agent': 'SneakerMonitor/2.0' } }, (res) => {
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
    if (text.length < 3 || text.length > 50) return false;
    if (text.toLowerCase().includes('redirect')) return false;
    if (text.toLowerCase().includes('category')) return false;
    if (text.toLowerCase().includes('external links')) return false;
    if (text.toLowerCase().includes('references')) return false;
    if (text.includes('://')) return false;

    // Explicitly reject non-sneaker items (clothing, accessories, non-sneaker footwear)
    const rejectWords = ['sandal', 'slide', 'boot', 'shirt', 'pant', 'short', 'hoodie', 'jacket', 'sock', 'hat', 'cap', 'cleat', 'spike', 'apparel', 'clothing', 'tee', 'jersey', 'tank', 'legging', 'tight', 'bra', 'bag', 'backpack', 'flip flop'];
    if (rejectWords.some(word => text.toLowerCase().includes(word))) return false;

    // Most models are alphanumeric with spaces, sometimes hyphens or dots or apostrophes
    if (!/^[a-zA-Z0-9\s-.'&]+$/.test(text)) return false;

    return true;
}

function extractModelsFromHTML(html, brand) {
    const models = new Set();

    // 1. Look for list items
    const liMatches = html.match(/<li>(.*?)<\/li>/g) || [];
    liMatches.forEach(li => {
        let text = cleanHtmlText(li);
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

async function generateHybridTaxonomy() {
    const taxonomy = { brands: [] };
    let total = 0;

    // Step 1: Execute Playwright Scraper on First-Party Sites
    let firstPartyModels = {};
    try {
        firstPartyModels = await scrapeOfficialSites();
    } catch (e) {
        console.error("Playwright Scraper Error:", e.message);
    }

    // Step 2: Sweep Wikipedia Pages
    for (const [brand, pages] of Object.entries(WIKIPEDIA_PAGES)) {
        // Init with Playwright models if available, resolving strict user requirement of no hardcoding
        let brandModels = new Set(firstPartyModels[brand] || []);
        console.log(`\n🔍 Playwright initially generated ${brandModels.size} live models for ${brand}`);

        console.log(`📚 Scanning Wikipedia for ${brand} history...`);
        for (const page of pages) {
            const html = await fetchWikipediaHtml(page);
            if (html) {
                const extracted = extractModelsFromHTML(html, brand);
                extracted.forEach(m => brandModels.add(m));
            }
        }

        let modelsArray = Array.from(brandModels).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        console.log(`✅ Final Deduplicated Set: ${modelsArray.length} models for ${brand}`);

        if (modelsArray.length > 0) {
            taxonomy.brands.push({ brand_name: brand, models: modelsArray });
            total += modelsArray.length;
        }

        await new Promise(r => setTimeout(r, 500));
    }

    // Add any brands that were found solely via Playwright and not in WIKIPEDIA_PAGES (if applicable)
    for (const [brand, models] of Object.entries(firstPartyModels)) {
        if (!WIKIPEDIA_PAGES[brand] && models.length > 0) {
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

    console.log(`\n🎯 Successfully compiled Hybrid Sneaker Taxonomy!`);
    console.log(`📊 Total dynamic models extracted across all sources: ${total}`);
}

generateHybridTaxonomy();
