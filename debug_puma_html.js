const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('https://us.puma.com/us/en/men/shoes', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(5000);

    // Dump HTML
    const html = await page.content();
    fs.writeFileSync('puma_plp.html', html);

    console.log("HTML length:", html.length);
    await browser.close();
})();
