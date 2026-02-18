const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1366, height: 768 });

    const url = 'https://www.alufsport.co.il/?s=Nike&post_type=product';
    console.log(`Navigating to ${url}...`);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 5000)); // Wait for render

    const result = await page.evaluate(() => {
        const data = {};

        // Check Body Classes
        data.bodyClasses = document.body.className;

        // Check standard WooCommerce structure
        data.isSingleProduct = document.body.classList.contains('single-product');
        data.hasH1ProductTitle = !!document.querySelector('h1.product_title');

        // Check "layout_item" structure (found in scripts)
        data.isLayoutItem = document.body.classList.contains('layout_item');
        data.itemDetails = !!document.querySelector('#item_details');

        if (data.itemDetails) {
            const h1 = document.querySelector('#item_details h1');
            data.title = h1 ? h1.innerText : 'N/A';
            const price = document.querySelector('#item_details .price_value');
            data.price = price ? price.innerText : 'N/A';
        } else if (data.hasH1ProductTitle) {
            data.title = document.querySelector('h1.product_title').innerText;
            const price = document.querySelector('p.price');
            data.price = price ? price.innerText : 'N/A';
        }

        // Search Grid Check
        data.gridItems = document.querySelectorAll('li.product, .product-grid-item').length;
        const listItems = document.querySelectorAll('.layout_list_item');
        data.layoutListItems = listItems.length;

        if (listItems.length > 0) {
            data.firstItemHtml = listItems[0].innerHTML;
        }

        return data;
    });

    console.log('Results:', result);

    await browser.close();
})();
