const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const SITES = [
    { name: 'Foot Locker', url: 'https://www.footlocker.co.il/search?q=MB.04', selector: '.product-item' },
    { name: 'Mega Sport', url: 'https://www.megasport.co.il/catalogsearch/result/?q=MB.04', selector: '.product-item-info' },
    { name: 'Terminal X', url: 'https://www.terminalx.com/catalogsearch/result/?q=MB.04', selector: '.product-item-link, a[data-test-id="product-link"]' },
    { name: 'ShoesOnline', url: 'https://shoesonline.co.il/?s=MB.04&post_type=product', selector: '.product-small' },
    { name: 'Factory 54', url: 'https://www.factory54.co.il/search?q=MB.04', selector: '.product-item, .card, div[data-id]' },
    { name: 'Ballers', url: 'https://ballers.co.il/?s=MB.04&post_type=product', selector: '.product, .type-product' },
    { name: 'Lime Shoes', url: 'https://limeshoes.co.il/?s=MB.04&post_type=product', selector: 'li.product, .product-grid-item' }
];

(async () => {
    console.log('🚀 Debugging MB.04 Search Results (Expanded List)...');

    // Launch Headful to see what happens
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1366,768']
    });

    for (const site of SITES) {
        console.log(`\nTesting ${site.name}...`);
        try {
            const page = await browser.newPage();
            await page.setViewport({ width: 1366, height: 768 });

            console.log(`   Navigating to: ${site.url}`);
            await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 30000 });

            // Wait a bit for CSR
            await new Promise(r => setTimeout(r, 4000));

            // Check results
            const count = await page.evaluate((sel, siteName) => {
                const diff = document.querySelectorAll(sel);
                // Filter visible if possible
                let c = 0;
                diff.forEach(d => {
                    // Basic check for non-hidden
                    if (d.offsetParent !== null) c++;
                });
                return c;
            }, site.selector, site.name);

            console.log(`   Found ${count} products`);

            // Log Page Title to see if we hit a 404 or something
            const title = await page.title();
            console.log(`   Page Title: ${title}`);

            await page.close();
        } catch (e) {
            console.error(`   Error checking ${site.name}: ${e.message}`);
        }
    }

    await browser.close();
})();
