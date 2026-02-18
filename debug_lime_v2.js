const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1366, height: 768 });

    // URL found in AJAX response
    const categoryUrl = 'https://limeshoes.co.il/category/brands/nike/';

    console.log(`Testing Category URL: ${categoryUrl}`);

    try {
        await page.goto(categoryUrl, { waitUntil: 'networkidle2', timeout: 60000 });

        await new Promise(r => setTimeout(r, 5000));

        const productCount = await page.evaluate(() => {
            return document.querySelectorAll('li.product, .product-grid-item').length;
        });
        console.log(`Product Count: ${productCount}`);

        if (productCount > 0) {
            console.log('SUCCESS! Found products on Category Page.');
            await page.screenshot({ path: 'debug_lime_category_success.png', fullPage: true });
        } else {
            console.log('No products found on Category Page.');
        }

    } catch (e) {
        console.error(`Error testing Category URL:`, e.message);
    }

    await browser.close();
})();
