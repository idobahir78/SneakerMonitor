const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

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

        const tileStart = html.indexOf('class="product-tile');
        if (tileStart !== -1) {
            // Backtrack to find the start of the div
            const chunkStart = html.lastIndexOf('<div', tileStart);
            console.log(`Found tile start at ${chunkStart}`);

            // Dump 3000 chars from there
            console.log("--- TILE DUMP START ---");
            console.log(html.substring(chunkStart, chunkStart + 3000));
            console.log("--- TILE DUMP END ---");
        } else {
            console.log("No 'class=\"product-tile' found.");
        }

    } catch (e) {
        console.error(e);
    }
    await browser.close();
})();
