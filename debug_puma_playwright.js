const { chromium } = require('playwright');

(async () => {
    console.log("Starting Puma Debug...");
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    });

    // Stealth-ish
    await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    const page = await context.newPage();
    page.setDefaultTimeout(30000);

    try {
        console.log("Navigating to Puma...");
        const response = await page.goto('https://us.puma.com/us/en/men/shoes', { waitUntil: 'domcontentloaded' });
        console.log("Status:", response.status());

        // Let it settle
        await page.waitForTimeout(5000);

        const title = await page.title();
        console.log("Page Title:", title);

        if (title.toLowerCase().includes('datadome') || title.toLowerCase().includes('cloudflare') || title.toLowerCase().includes('attention required') || response.status() === 403) {
            console.log("BLOCKED BY BOT PROTECTION.");
        } else {
            console.log("Checking selectors for Puma models...");
            const html = await page.content();

            // Try to find common product names
            const h3s = await page.$$eval('h3', els => els.map(e => e.innerText.trim()).filter(t => t));
            console.log("H3s found:", h3s.slice(0, 5));

            const titles = await page.$$eval('[data-test-id="product-list-item-title"]', els => els.map(e => e.innerText.trim()));
            console.log("Data-test-id titles:", titles.slice(0, 5));

            const prodTitles = await page.$$eval('.product-tile-title', els => els.map(e => e.innerText.trim()));
            console.log("product-tile-title:", prodTitles.slice(0, 10));
        }

    } catch (e) {
        console.error("Error:", e.message);
    } finally {
        await browser.close();
    }
})();
