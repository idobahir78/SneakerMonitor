const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');

async function run() {
    console.log('Starting Terminal X Audit Debug...');
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    try {
        await page.goto('https://www.terminalx.com/catalogsearch/result/?q=nike+dunk', { waitUntil: 'networkidle2', timeout: 30000 });

        // Wait for product tiles
        await page.waitForSelector('.catalog-category-item', { timeout: 10000 }).catch(() => console.log('Timeout waiting for .catalog-category-item'));

        const html = await page.evaluate(() => {
            const tiles = Array.from(document.querySelectorAll('.catalog-category-item, [data-test-id="product-card"]'));
            return tiles.slice(0, 3).map(el => el.outerHTML).join('\n\n<hr>\n\n');
        });

        fs.writeFileSync('tx_audit_tiles.html', html);
        await page.screenshot({ path: 'tx_audit_screenshot.png', fullPage: true });

        console.log('Saved to tx_audit_tiles.html and tx_audit_screenshot.png');
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await browser.close();
    }
}

run();
