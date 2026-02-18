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
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1366, height: 768 });

    const url = 'https://www.alufsport.co.il/?s=Nike&post_type=product';
    console.log(`Navigating to ${url}...`);

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Wait for body
    await page.waitForSelector('body');

    // Try to scroll to trigger lazy load
    await page.evaluate(() => window.scrollBy(0, 500));
    await new Promise(r => setTimeout(r, 2000));

    console.log('Capturing HTML...');
    const html = await page.content();
    fs.writeFileSync('aluf_puppeteer.html', html);

    console.log('Capturing Screenshot...');
    await page.screenshot({ path: 'aluf_puppeteer.png', fullPage: true });

    await browser.close();
    console.log('Done.');
})();
