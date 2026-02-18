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
    await new Promise(r => setTimeout(r, 5000));

    const result = await page.evaluate(() => {
        const items = [];
        const containerEls = document.querySelectorAll('.layout_list_item');

        containerEls.forEach((el, index) => {
            if (index > 2) return; // Limit to first 3

            const titleEl = el.querySelector('.title, .product_title');
            const priceEl = el.querySelector('.price, .price_value');
            const linkEl = el.querySelector('a');

            items.push({
                index,
                title: titleEl ? titleEl.innerText : 'N/A',
                price: priceEl ? priceEl.innerText : 'N/A',
                link: linkEl ? linkEl.href : 'N/A'
            });
        });

        return items;
    });

    console.log('Results:', result);

    await browser.close();
})();
