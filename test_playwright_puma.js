const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();

chromium.use(stealth);

async function testPumaScrape() {
    console.log('Launching headless browser with stealth mode...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    let modelsSet = new Set();

    try {
        console.log('Navigating to Puma.com categories...');
        const res = await page.goto('https://us.puma.com/us/en/men/shoes', { waitUntil: 'domcontentloaded' });

        console.log('Status code:', res.status());

        if (res.status() === 403 || res.status() > 400) {
            console.log('❌ Puma blocked us.', res.status());
            await page.screenshot({ path: 'puma_blocked.png' });
        } else {
            await page.waitForTimeout(3000);

            for (let i = 0; i < 3; i++) {
                await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight / 3));
                await page.waitForTimeout(2000);
            }

            console.log('Extracting model names from Puma...');
            // Puma uses [data-test-id="product-list-item-title"] or h3
            const titles = await page.$$eval('h3, [data-test-id="product-list-item-title"], .product-tile-title',
                nodes => nodes.map(n => n.innerText)
            );

            titles.forEach((t) => {
                let name = t.trim();
                // strip brand
                name = name.replace(/^Puma\s/i, '').trim();
                // Keep it if it looks like a valid model name (no newlines)
                if (name && name.length < 50 && !name.includes('\n')) {
                    modelsSet.add(name);
                }
            });

            console.log('✅ Success! Found the following models on Puma:');
            console.log(Array.from(modelsSet).join(', '));
            console.log('Total extracted:', modelsSet.size);
            await page.screenshot({ path: 'puma_success.png' });
        }
    } catch (e) {
        console.error('Scraping error:', e);
    } finally {
        await browser.close();
    }
}

testPumaScrape();
