const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const SITES = [
    { name: 'shoesonline', url: 'https://shoesonline.co.il/?s=nike&post_type=product' },
    { name: 'aloof', url: 'https://www.aloofsport.co.il/search/?q=nike' }
];

(async () => {
    console.log('Starting inspection...');
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--start-maximized']
    });

    for (const site of SITES) {
        console.log(`Checking ${site.name}...`);
        const page = await browser.newPage();

        try {
            await page.setViewport({ width: 1366, height: 768 });
            await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await new Promise(r => setTimeout(r, 5000)); // Wait for render

            const html = await page.content();
            const outputPath = path.join(__dirname, `inspect_${site.name}.html`);
            fs.writeFileSync(outputPath, html);
            console.log(`Saved HTML to ${outputPath}`);

        } catch (e) {
            console.error(`Error checking ${site.name}:`, e.message);
        } finally {
            await page.close();
        }
    }

    await browser.close();
    console.log('Done.');
})();
