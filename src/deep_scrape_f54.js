const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    console.log("--- Starting Deep Scrape F54 ---");
    const browser = await puppeteer.launch({ headless: false, args: ['--no-sandbox'] }); // Headless FALSE to see
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });

    try {
        await page.goto('https://www.factory54.co.il/search?q=On%20Cloud', { waitUntil: 'networkidle2', timeout: 90000 });

        // Wait for ANY product-like element (often grid items have prices)
        // Heuristic: look for element with '₪' text or price format
        console.log("Waiting for price elements...");
        try {
            await page.waitForFunction(() => {
                return Array.from(document.querySelectorAll('*')).some(el => el.textContent.includes('₪'));
            }, { timeout: 10000 });
        } catch (e) { console.log("Timeout waiting for ₪ symbol."); }

        // DOM Dump
        const items = await page.evaluate(() => {
            const candidates = [];
            const allDivs = document.querySelectorAll('div, a, li');

            allDivs.forEach(el => {
                const txt = el.textContent;
                if (txt.includes('₪') && txt.length < 100) {
                    // This element contains a price. Look at parents.
                    let parent = el.parentElement;
                    let depth = 0;
                    while (parent && depth < 3) {
                        // Check if parent looks like a product card (has image + title?)
                        const img = parent.querySelector('img');
                        if (img) {
                            candidates.push({
                                tag: parent.tagName,
                                class: parent.className,
                                innerText: parent.innerText.substring(0, 100)
                            });
                            break;
                        }
                        parent = parent.parentElement;
                        depth++;
                    }
                }
            });
            return candidates.slice(0, 5); // Return top 5 candidates
        });

        console.log("Deep Scrape Candidates:", JSON.stringify(items, null, 2));

    } catch (e) {
        console.error("F54 Error:", e);
    }
    await browser.close();
})();
