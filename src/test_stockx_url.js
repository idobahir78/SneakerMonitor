const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const colors = require('colors');

puppeteer.use(StealthPlugin());

async function testStockX() {
    const url = 'https://stockx.com/puma-lamelo-ball-mb05-fast-and-furious-suki?size=9.5';
    console.log(`Testing StockX URL: ${url}`.cyan);

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1366, height: 768 });

        // Set User-Agent manually just in case
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log('Navigating...');
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Wait for title or some element
        await page.waitForTimeout(5000);

        const title = await page.title();
        console.log(`Page Title: ${title}`.yellow);

        const content = await page.content();
        if (content.includes("Access Denied") || content.includes("Challenge")) {
            console.log("❌ Still blocked (Access Denied / Challenge)".red);
        } else {
            console.log("✅ Managed to load page!".green);
            // Try to find price
            // Note: StockX structure is complex, just checking if we see "Buy" or price
            const text = await page.evaluate(() => document.body.innerText);
            if (text.includes("$") || text.includes("Buy")) {
                console.log("   Found price/buy elements.".white);
            }
        }

    } catch (error) {
        console.error(`❌ Error: ${error.message}`.red);
    } finally {
        if (browser) await browser.close();
    }
}

testStockX();
