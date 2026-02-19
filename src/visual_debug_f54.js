const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

(async () => {
    console.log("--- Starting Visual Debug F54 ---");
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--start-maximized']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    try {
        await page.goto('https://www.factory54.co.il/search?q=On%20Cloud', { waitUntil: 'domcontentloaded', timeout: 60000 });
        console.log("Navigated. Waiting 15s...");
        await new Promise(r => setTimeout(r, 15000));

        // Screenshot
        await page.screenshot({ path: 'f54_visual.png', fullPage: true });
        console.log("Screenshot saved to f54_visual.png");

        // HTML Dump
        const html = await page.content();
        fs.writeFileSync('f54_visual.html', html);
        console.log("HTML saved to f54_visual.html");

    } catch (e) {
        console.error("F54 Visual Error:", e);
    }
    await browser.close();
})();
