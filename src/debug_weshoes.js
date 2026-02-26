const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function run() {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    console.log('Navigating to WeShoes...');
    await page.goto('https://www.weshoes.co.il/search?q=Hoka%20M%20SKYWARD%20X&type=product', { waitUntil: 'networkidle2' });

    console.log('Extracting first relevant product HTML...');
    const html = await page.evaluate(() => {
        // Find a tile that mentions Hoka
        const tiles = document.querySelectorAll('.product-card, .grid__item, .product-item, .collection-product, [class*="product"]');
        for (const tile of tiles) {
            if (tile.innerText.toUpperCase().includes('SKYWARD')) {
                return tile.outerHTML;
            }
        }
        return 'No HOKA tile found';
    });

    const fs = require('fs');
    fs.writeFileSync('weshoes_debug.html', html);
    console.log('Saved to weshoes_debug.html');

    await browser.close();
}

run().catch(console.error);
