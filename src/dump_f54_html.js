const fs = require('fs');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    const page = await browser.newPage();
    try {
        await page.goto('https://www.factory54.co.il/search?q=On%20Cloud', { waitUntil: 'networkidle2', timeout: 60000 });
        const html = await page.content();
        fs.writeFileSync('f54_debug.html', html);
        console.log("Dumped Factory 54 HTML to f54_debug.html");
    } catch (e) {
        console.error("Error dumping F54:", e);
    }
    await browser.close();
})();
