const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

(async () => {
    console.log("[ShoesOnline Debug] Launching...");
    puppeteer.use(StealthPlugin());

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        const url = 'https://shoesonline.co.il/?s=Nike&post_type=product';
        console.log(`[ShoesOnline Debug] Navigating to ${url}...`);

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Dump sample items
        const items = await page.evaluate(() => {
            const els = document.querySelectorAll('.product');
            return Array.from(els).slice(0, 5).map(el => {
                const priceEl = el.querySelector('.price');
                const titleEl = el.querySelector('.name, .woocommerce-loop-product__title');
                return {
                    title: titleEl ? titleEl.innerText : 'N/A',
                    priceHTML: priceEl ? priceEl.innerHTML : 'N/A',
                    priceText: priceEl ? priceEl.innerText : 'N/A'
                };
            });
        });

        console.log("--- Debug Items ---");
        console.log(JSON.stringify(items, null, 2));

    } catch (e) {
        console.log("Error:", e.message);
    } finally {
        await browser.close();
    }
})();
