const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    // SFCC AJAX Endpoint Pattern
    const url = 'https://www.factory54.co.il/on/demandware.store/Sites-factory54-Site/iw_IL/Search-ShowAjax?q=On%20Cloud&lang=iw_IL&cgid=men-shoes';

    console.log("Testing F54 AJAX Endpoint:", url);
    try {
        await page.goto(url, { waitUntil: 'networkidle2' });
        const content = await page.content();

        if (content.includes('product-tile') || content.includes('price')) {
            console.log("SUCCESS: Found product tiles in AJAX response.");
            console.log("Sample:", content.substring(0, 500));
        } else {
            console.log("FAILURE: AJAX response does not contain products.");
            console.log("Sample:", content.substring(0, 500));
        }
    } catch (e) {
        console.error("Error:", e);
    }
    await browser.close();
})();
