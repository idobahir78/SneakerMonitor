const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
puppeteer.use(StealthPlugin());

(async () => {
    console.log("Launching Headless Scout (Category HTML Dumper)...");
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const url = 'https://www.terminalx.com/men/neliim/sniqrs';
    console.log(`Navigating to: ${url}`);

    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });

    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        console.log("Page Loaded.");

        // Take screenshot for visual confirmation
        await page.screenshot({ path: 'tx_category_dump.png' });

        // Dump HTML
        const html = await page.content();
        fs.writeFileSync('tx_category_dump.html', html);
        console.log("Dumped HTML to tx_category_dump.html");

    } catch (e) {
        console.error("Action failed:", e.message);
    } finally {
        await browser.close();
    }
})();
