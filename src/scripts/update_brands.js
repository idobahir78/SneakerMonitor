const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const OUTPUT_FILE = path.join(__dirname, '../../frontend/src/data/brands.js');
const TARGET_BRANDS = ['Nike', 'Adidas', 'Jordan', 'New Balance', 'Puma', 'Under Armour', 'Asics', 'Hoka', 'On Cloud', 'Saucony'];

// Strict Blocklist for "Garbage" detected in initial scan
const BLOCKLIST = [
    'SALE', 'BEST OF', 'COLLECTION', 'JUST LANDED', 'LAST CALL', 'NEW', 'VIP',
    'DREAMCARD', 'FW23', 'FW24', 'SS23', 'SS24', 'GIFT', 'OUTLET', 'WIN',
    'BRANDS', 'DAY TO DAY', 'EXTRA', 'FINAL', 'FOX', 'GROUP', 'IL', 'LANDING'
];

// Manual overrides
const CORE_MODELS = {
    "Nike": ["Air Force 1", "Air Jordan 1", "Dunk Low", "Dunk High", "Air Max 90", "Pegasus 40", "Vomero 5"],
    "Adidas": ["Samba", "Gazelle", "Spezial", "Campus 00s", "Ultraboost", "Yeezy 350", "Stan Smith"],
    "New Balance": ["530", "550", "9060", "2002R", "1906R", "327", "990v6"],
    "Puma": ["MB.01", "MB.02", "MB.03", "MB.04", "MB.05", "Suede", "Mayze", "Palermo"],
    "On Cloud": ["Cloud 5", "Cloudmonster", "Cloudflow"],
    "Hoka": ["Clifton 9", "Bondi 8", "Arahi 7"],
    "Asics": ["Gel-Kayano 30", "Gel-Nimbus 26", "Novablast 4"],
    "Jordan": ["Retro 1", "Retro 3", "Retro 4", "Retro 11"]
};

let allModels = {};
TARGET_BRANDS.forEach(b => allModels[b] = new Set(CORE_MODELS[b] || []));

(async () => {
    console.log('🚀 Starting Model Discovery (Network Sniffer Edition)...');

    // Launch Headful to bypass simple anti-bots
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1366,768']
    });

    for (const brand of TARGET_BRANDS) {
        let modelsFound = new Set();
        let url = `https://www.terminalx.com/brands/${brand.toLowerCase().replace(/\s+/g, '-')}`;
        if (brand === 'Jordan') url = 'https://www.terminalx.com/brands/jordan';

        console.log(`Scanning ${brand}...`);

        try {
            const page = await browser.newPage();
            // Set big viewport
            await page.setViewport({ width: 1366, height: 768 });

            // Set up Network Interception
            page.on('response', async (response) => {
                const type = response.request().resourceType();
                // We care about XHR/Fetch (API calls) and Document (SSR execution)
                if (type === 'xhr' || type === 'fetch' || type === 'document') {
                    try {
                        const contentType = response.headers()['content-type'] || '';
                        if (contentType.includes('json') || contentType.includes('html')) {
                            // Read response text
                            const text = await response.text();

                            // Check for JSON product lists patterns
                            // Terminal X often sends { items: [ { name: ... } ] }
                            if (text.includes('"items":') && text.includes('"name":')) {
                                try {
                                    // Try strict JSON parse first
                                    const json = JSON.parse(text);

                                    // Recursive finder for "items" array with "name" propery
                                    const findItems = (obj) => {
                                        if (!obj) return;
                                        if (typeof obj !== 'object') return;

                                        // If it's an array, check if it looks like products
                                        if (Array.isArray(obj)) {
                                            if (obj.length > 0 && obj[0] && obj[0].name) {
                                                // Found a product list!
                                                obj.forEach(i => {
                                                    const clean = cleanName(i.name, brand);
                                                    if (clean) modelsFound.add(clean);
                                                });
                                            }
                                            obj.forEach(findItems); // Recurse
                                            return;
                                        }

                                        // Specific Terminal X structure:
                                        if (obj.items && Array.isArray(obj.items)) {
                                            const items = obj.items;
                                            if (items.length > 0 && items[0].name) {
                                                items.forEach(i => {
                                                    const clean = cleanName(i.name, brand);
                                                    if (clean) modelsFound.add(clean);
                                                });
                                            }
                                        }

                                        // Recurse object values
                                        Object.values(obj).forEach(findItems);
                                    };

                                    findItems(json);

                                } catch (e) {
                                    // If strict JSON fails (e.g. truncated), try regex
                                    // Regex for "name":"Product Name"
                                    const regex = /"name":"(.*?)"/g;
                                    let match;
                                    while ((match = regex.exec(text)) !== null) {
                                        if (!match[1].includes('http') && !match[1].includes('{')) {
                                            const clean = cleanName(match[1], brand);
                                            if (clean) modelsFound.add(clean);
                                        }
                                    }
                                }
                            }
                        }
                    } catch (e) {
                        // Ignore response read errors
                    }
                }
            });

            // Go to page
            // Use networkidle2 to ensure APIs have fired
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

            // Scroll to trigger lazy loading APIs
            await page.evaluate(() => {
                window.scrollBy(0, window.innerHeight);
                setTimeout(() => window.scrollBy(0, window.innerHeight), 1000);
            });

            // Wait for responses to settle
            await new Promise(r => setTimeout(r, 4000));

            console.log(`   [${brand}] Found ${modelsFound.size} models via Network Sniffer`);
            modelsFound.forEach(m => {
                if (m) allModels[brand].add(m);
            });

            await page.close();

        } catch (e) {
            console.error(`   Error scanning ${brand}:`, e.message);
        }
    }

    await browser.close();

    // Prepare Output
    const finalData = {};
    let totalCount = 0;
    for (const brand of TARGET_BRANDS) {
        const sorted = Array.from(allModels[brand]).sort();
        finalData[brand] = sorted;
        totalCount += sorted.length;
        console.log(`   ${brand}: ${sorted.length} total models`);
    }

    const fileContent = `const BRANDS_DATA = ${JSON.stringify(finalData, null, 4)};\n\nexport default BRANDS_DATA;`;
    fs.writeFileSync(OUTPUT_FILE, fileContent);
    console.log(`\n🎉 Updated ${OUTPUT_FILE} with ${totalCount} models!`);
})();

function cleanName(name, brand) {
    if (!name) return null;

    // Check against BLOCKLIST first
    const upper = name.toUpperCase();
    if (BLOCKLIST.some(bad => upper.includes(bad))) return null;

    // Remove Brand Name
    const brandRegex = new RegExp(`^${brand}\\s+`, 'i');
    name = name.replace(brandRegex, '').trim();

    // Cleanup Hebrew & common junk
    name = name.replace(/נעלי|ספורט|סניקרס|נשים|גברים|ילדים|מכנס|חולצת|טי-שירט|טייץ|גרביים|כפכפי|פלטפורמה/g, '').trim();
    name = name.replace(/WOMEN|MEN|YOUTH|KIDS/gi, '').trim();
    name = name.replace(/^-\s*/, '').trim();
    name = name.replace(/\//g, '').trim();

    // Tokenization
    const words = name.split(/\s+/);
    let finalWords = [];
    for (let w of words) {
        if (w.includes('₪')) break;
        if (w === '-') continue;
        if (finalWords.length >= 3) break;
        finalWords.push(w);
    }

    let model = finalWords.join(' ');
    // Validation
    if (model.length > 2 && !model.match(/^\d+$/) && !model.includes('...')) {
        return model;
    }
    return null;
}
