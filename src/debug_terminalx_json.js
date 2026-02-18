const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    const url = 'https://www.terminalx.com/catalogsearch/result/?q=530';

    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle2' });

    try {
        const state = await page.evaluate(() => window.__INITIAL_STATE__);

        if (state) {
            console.log("✅ Found window.__INITIAL_STATE__");

            // Inspect where products are
            // Common paths: state.catalog.products, state.search.results, etc.
            // Let's dump the keys to find the path
            console.log("Root Keys:", Object.keys(state));

            // Check for 'products' or 'search' in keys deep
            const findKeys = (obj, target, path = '') => {
                if (!obj || typeof obj !== 'object') return;
                if (Array.isArray(obj)) return; // skip arrays for brevity

                for (const key in obj) {
                    if (key.toLowerCase().includes(target)) {
                        console.log(`Found '${target}' at: ${path}.${key}`);
                    }
                    if (typeof obj[key] === 'object') {
                        // limit depth to avoid infinite recursion
                        if (path.split('.').length < 4) {
                            findKeys(obj[key], target, `${path}.${key}`);
                        }
                    }
                }
            };

            console.log("Searching for 'product' key...");
            findKeys(state, 'product');

            console.log("Searching for 'items' key...");
            findKeys(state, 'items');

        } else {
            console.log("❌ window.__INITIAL_STATE__ is undefined");
        }
    } catch (e) {
        console.error("Error extracting state:", e);
    }

    await browser.close();
})();
