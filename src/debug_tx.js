const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });

    const url = 'https://www.terminalx.com/men/neliim/sniqrs';
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    // Check for __INITIAL_STATE__
    const state = await page.evaluate(() => window.__INITIAL_STATE__);
    console.log('window.__INITIAL_STATE__ exists:', !!state);

    if (!state) {
        // Save HTML for inspection
        const html = await page.content();
        fs.writeFileSync('tx_debug.html', html);
        console.log('Saved tx_debug.html');

        // Take Screenshot
        await page.screenshot({ path: 'tx_debug.png', fullPage: true });
        console.log('Saved tx_debug.png');
    } else {
        console.log('State Keys:', Object.keys(state));
    }

    await browser.close();
})();
