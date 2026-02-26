const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function run() {
    console.log('Starting JD Sports Debug...');
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1024 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    try {
        await page.goto('https://www.jdsports.co.il/catalogsearch/result/?q=nike+dunk', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise(r => setTimeout(r, 6000));

        await page.screenshot({ path: 'jdsports_debug.png' });
        console.log('Screenshot saved to jdsports_debug.png');

        const html = await page.evaluate(() => {
            const results = [];
            document.querySelectorAll('.product-item, .product').forEach((el, idx) => {
                if (idx < 2) results.push(el.outerHTML.substring(0, 1500));
            });
            return results;
        });

        const fs = require('fs');
        fs.writeFileSync('jdsports_tiles.html', html.join('\n\n=====\n\n'));
        console.log('Saved to jdsports_tiles.html');

    } catch (e) {
        console.error('Error navigating to JD Sports:', e.message);
    }
    await browser.close();
}
run().catch(console.error);
