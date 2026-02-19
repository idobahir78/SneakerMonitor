const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    // Header setup
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://www.factory54.co.il/men',
        'X-Requested-With': 'XMLHttpRequest'
    });

    const apiUrl = `https://www.factory54.co.il/on/demandware.store/Sites-factory54-Site/iw_IL/Search-Show?q=Nike&lang=iw_IL&start=0&sz=36&format=ajax`;
    console.log(`Fetching F54 API: ${apiUrl}`);

    try {
        const response = await page.goto(apiUrl, { waitUntil: 'networkidle2' });
        const html = await response.text();

        console.log(`Response length: ${html.length}`);

        // Dump snippet around "product-tile" or similar
        const tileIndex = html.indexOf('product-tile');
        if (tileIndex !== -1) {
            console.log("Found 'product-tile' at index " + tileIndex);
            console.log("Snippet:", html.substring(tileIndex - 100, tileIndex + 500));
        } else {
            console.log("'product-tile' NOT found. Dumping body snippet:");
            const bodyStart = html.indexOf('<body');
            console.log(html.substring(bodyStart, bodyStart + 1000));
        }

        // Check for price
        const priceIndex = html.indexOf('sales');
        if (priceIndex !== -1) {
            console.log("Found 'sales' class at " + priceIndex);
            console.log(html.substring(priceIndex - 50, priceIndex + 200));
        }

    } catch (e) {
        console.error(e);
    }
    await browser.close();
})();
