
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function debugStockX() {
    console.log("Launching browser for StockX debug...");
    const browser = await puppeteer.launch({
        headless: false, // Visual debug
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1366, height: 768 });

        // Use the user's search term to replicate
        const url = 'https://stockx.com/search?s=Puma%20LaMelo';
        console.log(`Navigating to ${url}...`);

        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['media', 'font'].includes(req.resourceType())) req.abort();
            else req.continue();
        });

        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(5000); // Wait for hydration

        // Run the existing parsing logic
        const tileData = await page.evaluate(() => {
            // Replicate StockXScraper logic
            let tiles = Array.from(document.querySelectorAll('[data-testid="product-tile"]'));
            if (tiles.length === 0) tiles = Array.from(document.querySelectorAll('div[class*="product-tile"]'));
            if (tiles.length === 0) {
                tiles = Array.from(document.querySelectorAll('a')).filter(a => a.href.match(/\/[a-z0-9-]+$/) && !a.href.includes('/search'));
            }

            return tiles.map((tile, i) => {
                const text = tile.innerText;
                const lines = text.split('\n').filter(l => l.trim().length > 0);

                // Simulate price finding
                let foundPrice = "Not found";
                const priceLine = lines.find(l => l.includes('$') || l.match(/[0-9]+/));
                if (priceLine) {
                    const match = priceLine.match(/[0-9.]+/);
                    if (match) foundPrice = match[0];
                }

                return {
                    index: i,
                    lines: lines,
                    extractedPriceRaw: foundPrice
                };
            }).slice(0, 5); // Just first 5
        });

        console.log("--- TILE DATA ---");
        console.log(JSON.stringify(tileData, null, 2));

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await browser.close();
    }
}

debugStockX();
