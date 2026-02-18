const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
    });

    const page = await browser.newPage();
    // Use the same UA as Aluf just in case
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1366, height: 768 });

    const url = 'https://theshoval.com/search?q=Nike';
    console.log(`Navigating to ${url}...`);

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await new Promise(r => setTimeout(r, 5000));

        const result = await page.evaluate(() => {
            const data = {};

            data.bodyClasses = document.body.className;
            data.isSingleProduct = document.body.classList.contains('single-product');

            // Grid Selectors
            data.gridItemsOld = document.querySelectorAll('li.product, .product-grid-item').length;
            data.gridItemsNew = document.querySelectorAll('.layout_list_item').length;

            // Text Content check
            data.hasNike = document.body.innerText.includes('Nike');

            // Standard Product Card Classes Hunt
            const potentialClasses = ['.card', '.product', '.grid-view-item', '.item', '.product-card'];
            data.potentialMatches = {};
            potentialClasses.forEach(c => data.potentialMatches[c] = document.querySelectorAll(c).length);

            data.hasProducts = document.body.innerText.includes('מוצרים') || document.body.innerText.includes('Products');

            return data;
        });

        console.log('Results:', result);
        await page.screenshot({ path: 'test_shoval.png', fullPage: true });

        const html = await page.content();
        const fs = require('fs');
        fs.writeFileSync('test_shoval.html', html);

    } catch (e) {
        console.error('Error:', e.message);
    }

    await browser.close();
})();
