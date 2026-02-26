const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function run() {
    console.log('Starting Kicks Debug...');
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--ignore-certificate-errors', '--ignore-certificate-errors-spki-list']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1024 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    try {
        const response = await page.goto('https://kicks.co.il/?s=nike+dunk&post_type=product', { waitUntil: 'domcontentloaded', timeout: 30000 });
        console.log('Response Status:', response ? response.status() : 'null');
        await new Promise(r => setTimeout(r, 5000));

        await page.screenshot({ path: 'kicks_debug.png' });
        console.log('Screenshot saved to kicks_debug.png');

        const html = await page.content();
        const fs = require('fs');
        fs.writeFileSync('kicks_debug.html', html);
        console.log('HTML saved to kicks_debug.html');

    } catch (e) {
        console.error('Error navigating to Kicks:', e.message);
    }
    await browser.close();
}
run().catch(console.error);
