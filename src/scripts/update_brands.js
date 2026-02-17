const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const OUTPUT_FILE = path.join(__dirname, '../../frontend/src/data/brands.js');
const TARGET_BRANDS = ['Nike', 'Adidas', 'Jordan', 'New Balance', 'Puma', 'Under Armour', 'Asics', 'Hoka', 'On Cloud', 'Saucony'];

// 1. Generic Garbage Filter
const BLOCKLIST = [
    'SALE', 'BEST OF', 'COLLECTION', 'JUST LANDED', 'LAST CALL', 'NEW', 'VIP',
    'DREAMCARD', 'FW23', 'FW24', 'SS23', 'SS24', 'SS25', 'GIFT', 'OUTLET', 'WIN',
    'BRANDS', 'DAY TO DAY', 'EXTRA', 'FINAL', 'FOX', 'GROUP', 'IL', 'LANDING',
    'VIEW ALL', 'TEEN', 'BOYS', 'GIRLS', 'BABY', 'KIDS', 'WOMEN', 'MEN', 'IMPORT', 'PREMIUM', 'RETURN', 'EXCHANGE', 'TEST', 'TERMINAL', 'ANDROID',
    'IOS', 'APP', 'WORKOUT', 'ACTIVITIES', 'OS', 'ONE SIZE', 'MENS', 'WOMENS',
    'ACCESSORIES', 'SNEAKERS & SPORTSWEAR', 'SNEAKERS ICONS', 'SPORTEX15',
    'TX25 UP TO', 'SPORTS ACTIVITY', 'SPORTS FASHION', 'ALL SHOES',
    'ICONIC SNEAKERS', 'LAST CHANCE', 'URBAN EDIT', 'VALENTINES DAY',
    'VOTE SPORT', 'UP TO 149.9', 'BACK TO COLLEGE', 'BASKETBALL', 'LIFESTYLE',
    'PAGUMX', 'STREET WEAR', 'STREETSTYLE', '15% OFF', '20% OFF', '30% OFF',
    'SPORT15', 'SPORT30', 'VOTE 30', 'ACTIVITY', 'ORIGINALS', 'PERFORMANCE',
    'PROFESSIONAL RUNNING', 'RUNNING SHOES', 'SOCCER', 'STREET', 'UNDERWEAR',
    'BRA', 'LEGGINGS', 'TOP', 'VEST', 'SHORT', 'DRESS', 'SKIRT', 'PANT', 'TIGHTS',
    'TANK', 'HOODIE', 'SWEATSHIRT', 'JACKET', 'COAT', 'SOCKS', 'HAT', 'BAG',
    'SWIM', 'GIFT CARD', 'EQUIPMENT', 'BALL', 'JERSEY', 'TEE', 'POCKET',
    'FLEECE', 'KNIT', 'WOVEN', 'CARGO', 'CHINO', 'JEANS', 'DENIM', 'CLOTHING',
    'APPAREL', 'ACTIVEWEAR', 'YOGA', 'TRAINING', 'FITNESS', 'SPORTS', 'MOTO',
    'AUTO', 'RACING', 'OUTDOOR', 'BOXER', 'BRIEF', 'TRUNK', 'UNDIES', 'CAMI',
    'BODYSUIT', 'BRALETTE', 'HIKING', 'GEAR', 'MAT', 'TOWEL', 'BOTTLE', 'SANTAGZ',
    'SHAVUOT', 'V DAY'
];

const HEBREW_BLOCKLIST = [
    'דף הבית', 'מותגים', 'פעילות', 'קטגוריות', 'קולקציות', 'אביזרים', 'אימון', 'בנות', 'בנים', 'גברים', 'נשים', 'ילדים', 'בייבי',
    'נייק', 'אדידס', 'פומה', 'אנדר ארמור', 'אסיקס', 'סאקוני', 'הוקה', 'סנדלים',
    'כפכפים', 'חולצות', 'מכנסיים', 'טייצים', 'חזיות', 'חזיית', 'גרביים', 'כובעים',
    'תיקים', 'בגדי ים', 'הלבשה תחתונה', 'שרוול קצר', 'שרוול ארוך', 'גופיות',
    'סטייל', 'מבצע', 'הנחה', 'חדש', 'בלעדי', 'חולצה', 'מכנס', 'ג\'ינס', 'כדור',
    'ציוד', 'סווטשירט', 'קפוצ\'ון', 'ז\'קט', 'מעיל', 'חצאית', 'שמלה', 'בגד ים',
    'אביזרי', 'אקססוריז', 'ריצה', 'ספורט', 'תחתונים', 'מארז', 'גופיית', 'גופיה',
    'טי שירט', 'טישירט', 'חולצת', 'מכנסי', 'טופים', 'פולו', 'שבועות', 'וולנטיין'
];

// 2. Clothing Filter (Hebrew + English) - We want SHOES ONLY
const CLOTHING_TERMS = [
    'חולצת', 'חולצה', 'מכנס', 'מכנסיים', 'טייץ', 'גופייה', 'גופיה', 'סווטשירט', 'קפוצ\'ון',
    'מעיל', 'ג\'קט', 'גרביים', 'כובע', 'תיק', 'בגד ים', 'בגדי ים', 'הלבשה תחתונה',
    'SHIRT', 'PANT', 'TIGHTS', 'TANK', 'HOODIE', 'SWEATSHIRT', 'JACKET', 'COAT', 'SOCKS',
    'HAT', 'BAG', 'SWIM', 'UNDERWEAR', 'BRA', 'LEGGINGS', 'TOP', 'VEST', 'SHORT', 'DRESS', 'SKIRT'
];

// 3. Manual Core Models (Expanded)
const CORE_MODELS = {
    "Nike": ["Air Force 1", "Air Jordan 1", "Dunk Low", "Dunk High", "Air Max 90", "Pegasus 40", "Vomero 5", "P-6000", "Cortez", "Blazer", "Air Max 1", "Air Max 97", "Air Max 95"],
    "Adidas": ["Samba", "Gazelle", "Spezial", "Campus 00s", "Ultraboost", "Yeezy 350", "Stan Smith", "Forum", "Adizero", "SL 72"],
    "New Balance": ["530", "550", "9060", "2002R", "1906R", "327", "990v6", "1080", "Fresh Foam", "480", "574"],
    "Puma": ["MB.01", "MB.02", "MB.03", "MB.04", "MB.05", "Suede", "Mayze", "Palermo", "Velophasis", "Clyde"],
    "On Cloud": ["Cloud 5", "Cloudmonster", "Cloudflow", "Cloudnova", "Cloud X"],
    "Hoka": ["Clifton 9", "Bondi 8", "Arahi 7", "Speedgoat 5", "Mach 6", "Transport"],
    "Asics": ["Gel-Kayano 30", "Gel-Nimbus 26", "Novablast 4", "Gel-NYC", "GT-2000", "Gel-1130"],
    "Jordan": [
        "Air Jordan 1 Low", "Air Jordan 1 Mid", "Air Jordan 1 High",
        "Retro 3", "Retro 4", "Retro 5", "Retro 6", "Retro 11", "Retro 12", "Retro 13",
        "Luka 1", "Luka 2", "Luka 3", "Tatum 1", "Tatum 2", "Jumpman", "MVP", "Spizike"
    ]
};

let allModels = {};
TARGET_BRANDS.forEach(b => allModels[b] = new Set(CORE_MODELS[b] || []));

(async () => {
    console.log('🚀 Starting Model Discovery (Network Sniffer Edition - Strict Mode)...');

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

    // CLOTHING CHECK (Strict)
    if (CLOTHING_TERMS.some(term => upper.includes(term))) return null;

    // Remove Brand Name
    const brandRegex = new RegExp(`^${brand}\\s+`, 'i');
    name = name.replace(brandRegex, '').trim();

    // Cleanup Hebrew & common junk
    name = name.replace(/נעלי|ספורט|סניקרס|נשים|גברים|ילדים|יוניסקס|פלטפורמה|נוער/g, '').trim();

    // Hebrew Blocklist Check
    if (HEBREW_BLOCKLIST.some(bad => name.includes(bad))) return null;

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
