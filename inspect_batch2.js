const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const SITES = [
    { name: 'limeshoes', url: 'https://limeshoes.co.il/?s=nike&post_type=product' },
    { name: 'mayers', url: 'https://mayers.co.il/?s=nike&post_type=product' },
    { name: 'shoes2u', url: 'https://www.shoes2u.co.il/search/?q=nike' },
    { name: 'arba4', url: 'https://arba4.co.il/?s=nike&post_type=product' }
];

(async () => {
    console.log('Starting Batch 2 Inspection...');
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
            await new Promise(r => setTimeout(r, 8000)); // Wait for render/overlays

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
