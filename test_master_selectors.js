const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
    });

    const page = await browser.newPage();
    // Use consistent successful UA
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

    try {
        console.log('Navigating to Master Sport search...');
        // Correct URL? Let's check the scraper file first, but assume standard for now.
        // Assuming search URL structure
        await page.goto('https://mastersport.co.il/?s=Nike&post_type=product', { waitUntil: 'networkidle2', timeout: 60000 });

        console.log('Page loaded. waiting for 5s...');
        await new Promise(r => setTimeout(r, 5000));

        // Screenshot
        await page.screenshot({ path: 'test_master.png', fullPage: true });
        console.log('Screenshot saved to test_master.png');

        // HTML Dump
        const html = await page.content();
        fs.writeFileSync('test_master.html', html);
        console.log('HTML saved to test_master.html');

        // Quick Selector Check
        const results = await page.evaluate(() => {
            return {
                bodyClasses: document.body.className,
                productSmall: document.querySelectorAll('.product-small').length,
                liProduct: document.querySelectorAll('li.product').length,
                divProduct: document.querySelectorAll('div.product').length,
                card: document.querySelectorAll('.card').length,
                titles: Array.from(document.querySelectorAll('h1, h2, h3, .name')).map(el => el.innerText).slice(0, 5)
            };
        });

        console.log('Selector Check:', results);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
})();
