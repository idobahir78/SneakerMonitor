const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function run() {
    console.log('Starting On Cloud UI Debug...');
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1024 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    try {
        await page.goto('https://ing-sport.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise(r => setTimeout(r, 4000));

        console.log('Typing in search...');
        const searchInput = await page.$('input[type="text"], input[name="q"], input[type="search"]');
        if (searchInput) {
            await searchInput.type('cloudmonster');
            await page.keyboard.press('Enter');
            await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 });
            console.log('New URL:', page.url());
            await new Promise(r => setTimeout(r, 4000));

            await page.screenshot({ path: 'oncloud_debug2.png' });

            const html = await page.evaluate(() => {
                const results = [];
                document.querySelectorAll('.product-item-info, .product-card, .product-item-details').forEach((el, idx) => {
                    if (idx < 2) results.push(el.outerHTML.substring(0, 1500));
                });
                return results;
            });
            require('fs').writeFileSync('oncloud_tiles2.html', html.join('\n\n=====\n\n'));
        } else {
            console.log('Search input not found on homepage.');
        }
    } catch (e) { console.error('Error:', e.message); }
    await browser.close();
}
run().catch(console.error);
