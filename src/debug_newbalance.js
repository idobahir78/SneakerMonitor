const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function run() {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1024 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    console.log('Navigating to New Balance IL homepage...');
    await page.goto('https://www.newbalance.co.il/', { waitUntil: 'domcontentloaded', timeout: 60000 });

    console.log('Finding search input...');
    const searchSelectors = ['input[type=search]', 'input[name=q]', '#search'];
    let searchInput;
    for (const sel of searchSelectors) {
        searchInput = await page.$(sel);
        if (searchInput) {
            console.log('Found search input with selector:', sel);
            break;
        }
    }

    if (searchInput) {
        console.log('Typing query and pressing Enter...');
        // Sometimes the search bar is hidden and needs a click on an icon first
        try {
            const icon = await page.$('.action.search, .search-icon');
            if (icon) {
                console.log('Clicking search icon first...');
                await icon.click();
                await new Promise(r => setTimeout(r, 1000));
            }
        } catch (e) { }

        await searchInput.type('990');
        await searchInput.press('Enter');

        console.log('Waiting for navigation...');
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => console.log('Wait timeout, continuing...'));

        console.log('New URL:', page.url());

        // Let's also grab the HTML of a product tile to make sure our selectors match
        const tilesHtml = await page.evaluate(() => {
            const results = [];
            const productTiles = document.querySelectorAll('.product-item, .item-product, .product');
            for (let i = 0; i < Math.min(2, productTiles.length); i++) {
                results.push(productTiles[i].outerHTML.substring(0, 500));
            }
            return results;
        });
        console.log('Product HTML:', tilesHtml);
    } else {
        console.log('Could not find search input.');
    }

    await browser.close();
}
run().catch(console.error);
