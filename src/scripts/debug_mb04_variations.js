const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const QUERIES = ['MB.04', 'MB 04', 'MB04', 'LaMelo'];

const SITES = [
    { name: 'Mega Sport', urlTemplate: 'https://www.megasport.co.il/catalogsearch/result/?q=QUERY', selector: '.product-item-info' },
    { name: 'Terminal X', urlTemplate: 'https://www.terminalx.com/catalogsearch/result/?q=QUERY', selector: '.product-item-link, a[data-test-id="product-link"]' },
    { name: 'ShoesOnline', urlTemplate: 'https://shoesonline.co.il/?s=QUERY&post_type=product', selector: '.product-small' },
    { name: 'Lime Shoes', urlTemplate: 'https://limeshoes.co.il/?s=QUERY&post_type=product', selector: 'li.product, .product-grid-item' }
];

(async () => {
    console.log('🚀 Debugging MB.04 Selection Variations...');

    // Launch Headful
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1366,768']
    });

    for (const site of SITES) {
        console.log(`\n--- Testing ${site.name} ---`);

        for (const query of QUERIES) {
            const url = site.urlTemplate.replace('QUERY', encodeURIComponent(query));
            try {
                const page = await browser.newPage();
                await page.setViewport({ width: 1366, height: 768 });

                // console.log(`   Trying "${query}"...`);
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

                // Wait for CSR
                await new Promise(r => setTimeout(r, 3000));

                // Check results
                const count = await page.evaluate((sel) => {
                    const diff = document.querySelectorAll(sel);
                    let c = 0;
                    diff.forEach(d => { if (d.offsetParent !== null) c++; });
                    return c;
                }, site.selector);

                console.log(`   Query: "${query}" -> Found ${count} products`);

                await page.close();

                // If we found good results, maybe skip others? Nah, let's see which is best.

            } catch (e) {
                console.error(`   Error "${query}": ${e.message}`);
            }
        }
    }

    await browser.close();
})();
