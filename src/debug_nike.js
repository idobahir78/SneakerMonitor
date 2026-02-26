const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function run() {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    console.log('Navigating to Nike Israel...');
    await page.goto('https://www.nike.com/il/w?q=Nike%20Air%20Max', { waitUntil: 'networkidle2' });

    console.log('Extracting first product HTML...');
    const html = await page.evaluate(() => {
        const tile = document.querySelector('.product-card, .product-grid__item');
        return tile ? tile.outerHTML : 'No tile found';
    });

    const fs = require('fs');
    fs.writeFileSync('nike_debug.html', html);
    console.log('Saved to nike_debug.html');

    await browser.close();
}
run().catch(console.error);
