const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Set standard headers to mimic a real browser request
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Referer': 'https://www.factory54.co.il/men/shoes',
        'X-Requested-With': 'XMLHttpRequest'
    });

    // SFCC AJAX Endpoint Pattern (Verified pattern for SFCC sites)
    const url = 'https://www.factory54.co.il/on/demandware.store/Sites-factory54-Site/iw_IL/Search-ShowAjax?q=On%20Running&lang=iw_IL&cgid=men-shoes&start=0&sz=24';

    console.log("Testing F54 AJAX Endpoint:", url);
    try {
        const response = await page.goto(url, { waitUntil: 'networkidle2' });
        const content = await response.text();

        console.log("Response Status:", response.status());
        console.log("Response Length:", content.length);

        if (content.includes('product-tile') || content.includes('price') || content.includes('products')) {
            console.log("SUCCESS: Found product data/tiles in AJAX response.");
            // Log a snippet to confirm structure
            if (content.length > 500) console.log("Sample:", content.substring(0, 500));
            else console.log("Full Content:", content);
        } else {
            console.log("FAILURE: AJAX response does not contain obvious product data.");
            console.log("Sample:", content.substring(0, 500));
        }
    } catch (e) {
        console.error("Error:", e);
    }
    await browser.close();
})();
