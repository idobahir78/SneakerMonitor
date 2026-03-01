const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();

chromium.use(stealth);

async function testNikeScrape() {
    console.log('Launching headless browser with stealth mode...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();

    let modelsSet = new Set();

    try {
        console.log('Navigating to Nike.com Mens Shoes...');
        const res = await page.goto('https://www.nike.com/w/mens-shoes-nik1zy7ok', { waitUntil: 'domcontentloaded' });

        console.log('Status code:', res.status());

        if (res.status() === 403) {
            console.log('❌ Nike blocked us despite Stealth Plugin.');
            await page.screenshot({ path: 'nike_blocked.png' });
        } else {
            // Wait for product cards to load
            await page.waitForTimeout(3000);

            // Scroll a bit to trigger lazy loading
            for (let i = 0; i < 3; i++) {
                await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight / 3));
                await page.waitForTimeout(2000);
            }

            console.log('Extracting model names...');
            const titles = await page.$$eval('.product-card__title', nodes => nodes.map(n => n.innerText));
            const subTitles = await page.$$eval('.product-card__subtitle', nodes => nodes.map(n => n.innerText));

            titles.forEach((t, i) => {
                let name = t.trim();
                // Nike appends "By You" for custom shoes, strip it
                name = name.replace(/By You/i, '').trim();
                // Strip brand
                name = name.replace(/^Nike\s/i, '').trim();
                name = name.replace(/^Jordan\s/i, '').trim();

                // Keep it if it looks like a valid model name
                if (name && name.length < 50) {
                    modelsSet.add(name);
                }
            });

            console.log('✅ Success! Found the following models on the front page:');
            console.log(Array.from(modelsSet).join(', '));
            console.log('Total extracted:', modelsSet.size);
            await page.screenshot({ path: 'nike_success.png' });
        }
    } catch (e) {
        console.error('Scraping error:', e);
    } finally {
        await browser.close();
    }
}

testNikeScrape();
