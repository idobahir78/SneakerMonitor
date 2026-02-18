const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    console.log("Launching Headless Scout (Category/Brand Validation)...");
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    // Test URLs:
    // 1. Terminal X: Men Sneakers Category
    // 2. Factory 54: Nike Brand Page
    const targets = [
        { name: 'Terminal X Category', url: 'https://www.terminalx.com/men/shoes/sneakers' },
        { name: 'Factory 54 Brand', url: 'https://www.factory54.co.il/designers/puma' } // Testing Puma as requested in task
    ];

    for (const target of targets) {
        console.log(`\n--- Testing ${target.name} ---`);
        const page = await browser.newPage();
        await page.setViewport({ width: 1366, height: 768 });

        try {
            console.log(`Navigating to: ${target.url}`);
            const response = await page.goto(target.url, { waitUntil: 'networkidle2', timeout: 60000 });
            console.log(`Status: ${response.status()}`);
            console.log(`Title: ${await page.title()}`);

            // Check for products
            const productCount = await page.evaluate(() => {
                // Generic selector scope
                return document.querySelectorAll('.product-item, .listing-item, div[data-product-id], a.item-link').length;
            });
            console.log(`Products Detected: ${productCount}`);

            if (productCount > 0) {
                console.log("SUCCESS: Category/Brand page maps successfully.");
            } else {
                console.log("FAILURE: No products found.");
            }

            await page.screenshot({ path: `${target.name.replace(/\s+/g, '_')}_test.png` });

        } catch (e) {
            console.error(`Error validating ${target.name}: ${e.message}`);
        } finally {
            await page.close();
        }
    }

    await browser.close();
})();
