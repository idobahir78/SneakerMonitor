const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const TARGET_BRANDS = ['Nike', 'Adidas', 'Jordan', 'New Balance', 'Puma', 'Under Armour', 'Asics', 'Hoka', 'On Cloud', 'Saucony'];
const OUTPUT_FILE = path.join(__dirname, '../../frontend/src/data/brands.js');

(async () => {
    console.log('Starting Model Discovery from Shoesonline...');
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    const page = await browser.newPage();

    let newBrandsData = {};

    for (const brand of TARGET_BRANDS) {
        console.log(`Scanning models for: ${brand}...`);
        try {
            // Search for the brand on Shoesonline to get a list of products
            const url = `https://shoesonline.co.il/?s=${encodeURIComponent(brand)}&post_type=product`;
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForSelector('.products', { timeout: 10000 }).catch(() => null);

            const models = await page.evaluate((brand) => {
                const items = document.querySelectorAll('.product-title, .woocommerce-loop-product__title');
                const uniqueModels = new Set();

                items.forEach(item => {
                    let text = item.innerText.trim();
                    // Remove Brand Name from start (case insensitive)
                    const regex = new RegExp(`^${brand}\\s+`, 'i');
                    let model = text.replace(regex, '').trim();

                    // Clean up common noise
                    model = model.split('|')[0].trim(); // Remove " | ..."
                    model = model.replace(/WOMEN|MEN|YOUTH|KIDS/gi, '').trim();
                    model = model.replace(/^-\s*/, '').trim();

                    // Simplify: take first 2-3 words as the model "family"
                    // e.g. "Air Force 1 '07" -> "Air Force 1"
                    // This is a heuristic to avoid thousands of specific colorways
                    const words = model.split(' ');
                    if (words.length > 3) {
                        // Keep reasonable length model names
                        // "Air Jordan 1 Low" -> 4 words (Air, Jordan, 1, Low)
                        // "Dunk Low Retro"
                    }

                    if (model && model.length > 2) {
                        uniqueModels.add(model);
                    }
                });
                return Array.from(uniqueModels);
            }, brand);

            console.log(`Found ${models.length} models for ${brand}`);
            newBrandsData[brand] = models.sort();

        } catch (e) {
            console.error(`Error scanning ${brand}:`, e.message);
            newBrandsData[brand] = [];
        }
    }

    await browser.close();

    // Formatting output
    const fileContent = `const BRANDS_DATA = ${JSON.stringify(newBrandsData, null, 4)};\n\nexport default BRANDS_DATA;`;

    fs.writeFileSync(OUTPUT_FILE, fileContent);
    console.log(`Updated ${OUTPUT_FILE}`);

})();
