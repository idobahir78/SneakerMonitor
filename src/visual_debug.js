const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const colors = require('colors');

puppeteer.use(StealthPlugin());

async function visualDebug() {
    console.log(`\n👁️ Starting ISRAELI SITES Debug (Searching "puma")...`.cyan.bold);

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null,
            args: ['--start-maximized', '--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        // --- TEST 1: Factory 54 ---
        const f54Url = 'https://www.factory54.co.il/search?q=puma';
        console.log(`\n1. Navigating to Factory 54 (${f54Url})...`.white);
        await page.goto(f54Url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(5000);

        const f54Debug = await page.evaluate(() => {
            const tiles = document.querySelectorAll('.product_list_item, .product-item, .product-tile, [data-id]');
            // Get all links that look like products
            // Adjust pattern based on observation
            const productLinks = Array.from(document.querySelectorAll('a')).filter(a => a.href.includes('/item/') || a.href.includes('/shop/'));

            return {
                title: document.title,
                tilesCount: tiles.length,
                linksCount: productLinks.length,
                firstLink: productLinks.length > 0 ? productLinks[0].href : 'N/A',
                // Log class names of major containers to guess selector
                bodyClasses: document.body.className
            };
        });

        console.log(`   PAGE TITLE: ${f54Debug.title}`.cyan);
        console.log(`   Tiles found: ${f54Debug.tilesCount}`);
        console.log(`   Product Links found: ${f54Debug.linksCount}`);
        console.log(`   First Link: ${f54Debug.firstLink}`);


        // --- TEST 2: Terminal X ---
        const txUrl = 'https://www.terminalx.com/catalogsearch/result/?q=puma';
        console.log(`\n2. Navigating to Terminal X (${txUrl})...`.white);
        await page.goto(txUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(5000);

        const txDebug = await page.evaluate(() => {
            const tiles = document.querySelectorAll('.product-item-info, .product_item, li.item');
            const productLinks = Array.from(document.querySelectorAll('a')).filter(a => a.href.includes('/p/'));

            return {
                title: document.title,
                tilesCount: tiles.length,
                linksCount: productLinks.length,
                firstLink: productLinks.length > 0 ? productLinks[0].href : 'N/A'
            };
        });

        console.log(`   PAGE TITLE: ${txDebug.title}`.cyan);
        console.log(`   Tiles found: ${txDebug.tilesCount}`);
        console.log(`   Product Links found: ${txDebug.linksCount}`);

        // --- TEST 3: Foot Locker ---
        const flUrl = 'https://www.footlocker.co.il/search?q=puma';
        console.log(`\n3. Navigating to Foot Locker (${flUrl})...`.white);
        await page.goto(flUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(5000);

        const flDebug = await page.evaluate(() => {
            const tiles = document.querySelectorAll('.product-item, .item');
            return {
                title: document.title,
                tilesCount: tiles.length
            };
        });

        console.log(`   PAGE TITLE: ${flDebug.title}`.cyan);
        console.log(`   Tiles found: ${flDebug.tilesCount}`);

    } catch (error) {
        console.log(`❌ Error: ${error.message}`.red);
    } finally {
        console.log(`\nClosing in 20 seconds...`.magenta);
        await new Promise(r => setTimeout(r, 20000));
        if (browser) await browser.close();
    }
}

visualDebug();
