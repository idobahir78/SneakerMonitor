const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function run() {
    console.log('Starting Mayers Selectors Debug...');
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1024 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    try {
        await page.goto('https://www.mayers.co.il/?s=nike+dunk&post_type=product', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise(r => setTimeout(r, 6000));

        const products = await page.evaluate(() => {
            const results = [];
            // Let's grab the HTML of the main grid items wrapping the images
            document.querySelectorAll('.product, .product-card, .grid__item, .product-item, .collection-product-card').forEach((el, index) => {
                if (index < 2) {
                    results.push(el.outerHTML.substring(0, 1500));
                }
            });
            return results;
        });

        const fs = require('fs');
        fs.writeFileSync('mayers_tiles.html', products.join('\n\n=====\n\n'));
        console.log('Saved to mayers_tiles.html');

    } catch (e) {
        console.error('Error:', e.message);
    }
    await browser.close();
}
run().catch(console.error);
