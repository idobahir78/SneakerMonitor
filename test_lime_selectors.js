const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function run() {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security', '--disable-features=IsolateOrigins,site-per-process']
    });
    const page = await browser.newPage();

    // Set a realistic User-Agent (Chrome 121)
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

    try {
        console.log('Navigating to Lime Shoes...');
        // Search for "Nike"
        await page.goto('https://limeshoes.co.il/?s=Nike&post_type=product', { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Wait a bit for dynamic content
        await new Promise(r => setTimeout(r, 5000));

        console.log('Taking screenshot...');
        await page.screenshot({ path: 'test_lime.png', fullPage: true });

        console.log('Dumping HTML...');
        const html = await page.content();
        fs.writeFileSync('test_lime.html', html);

        // Quick selector check
        const productCount = await page.evaluate(() => {
            return document.querySelectorAll('li.product, .product-grid-item').length;
        });
        console.log(`Found ${productCount} potential product elements.`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
}

run();
