const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function run() {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1024 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    console.log('Navigating to Adidas Israel...');
    await page.goto('https://www.adidas.co.il/he/search?q=Samba', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 6000));

    console.log('Evaluating DOM for Samba products...');
    const products = await page.evaluate(() => {
        const results = [];
        const tiles = document.querySelectorAll('.products-item');
        for (let i = 0; i < Math.min(2, tiles.length); i++) {
            results.push(tiles[i].innerHTML);
        }
        return results;
    });

    const fs = require('fs');
    fs.writeFileSync('adidas_tile_debug.html', products.join('\n\n=====\n\n'));
    console.log('Saved to adidas_tile_debug.html');
    await browser.close();
}
run().catch(console.error);
