const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    console.log("Launching Headless Scout (URL Validator)...");
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });

    // The discovered URL from Schema.org
    const targetUrl = 'https://www.terminalx.com/catalogsearch/result/?q=Nike&SeRef=slsb';
    console.log(`Navigating to Target URL: ${targetUrl}`);

    try {
        const response = await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        const status = response.status();
        console.log(`Status Code: ${status}`);

        const title = await page.title();
        console.log(`Page Title: ${title}`);

        // Check for "0 results" textual indicators or product list
        const bodyText = await page.evaluate(() => document.body.innerText);
        if (bodyText.includes('לא נמצאו תוצאות') || bodyText.includes('0 תוצאות')) {
            console.log("Result: 0 Results Found (Page Loaded but Empty)");
        } else {
            // Check for product cards
            const productCount = await page.evaluate(() => document.querySelectorAll('div[data-product-id], li.product-item').length);
            console.log(`Result: Found ${productCount} products.`);
        }

        await page.screenshot({ path: 'tx_url_test.png' });

    } catch (e) {
        console.error("Action failed:", e.message);
    } finally {
        await browser.close();
    }
})();
