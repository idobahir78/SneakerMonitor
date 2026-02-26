const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function run() {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1024 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    console.log('Navigating to Adidas Israel...');
    await page.goto('https://www.adidas.co.il/he/search?q=Samba', { waitUntil: 'networkidle0', timeout: 60000 });

    console.log('Taking screenshot...');
    await page.screenshot({ path: 'adidas_debug.png' });

    await browser.close();
}
run().catch(console.error);
