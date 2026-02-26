const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');

async function run() {
    console.log('Starting Factory 54 Audit Debug...');
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Set a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    try {
        await page.goto('https://www.factory54.co.il/men/shoes?q=nike+dunk', { waitUntil: 'networkidle2', timeout: 30000 });

        // Wait specifically for product tiles
        await page.waitForSelector('[data-product-id], .product-item', { timeout: 10000 }).catch(() => console.log('Timeout waiting for products'));

        const html = await page.evaluate(() => {
            const tiles = Array.from(document.querySelectorAll('[data-product-id], .product-item, .item-box'));
            return tiles.slice(0, 3).map(el => el.outerHTML).join('\n\n<hr>\n\n');
        });

        fs.writeFileSync('f54_audit_tiles.html', html);
        await page.screenshot({ path: 'f54_audit_screenshot.png', fullPage: true });

        console.log('Saved to f54_audit_tiles.html and f54_audit_screenshot.png');
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await browser.close();
    }
}

run();
