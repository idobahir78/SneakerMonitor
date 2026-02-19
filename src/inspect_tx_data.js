const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const vm = require('vm');

(async () => {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    const url = 'https://www.terminalx.com/men/neliim/sniqrs';

    console.log("Navigating to TX...");
    await page.goto(url, { waitUntil: 'networkidle2' });

    const html = await page.content();
    const markers = ['window.__INITIAL_STATE__ ='];
    let startIndex = -1;
    for (const m of markers) {
        startIndex = html.indexOf(m);
        if (startIndex !== -1) break;
    }

    if (startIndex !== -1) {
        const scriptEnd = html.indexOf('</script>', startIndex);
        if (scriptEnd !== -1) {
            let scriptContent = html.substring(startIndex, scriptEnd);
            const sandbox = { window: {} };
            vm.createContext(sandbox);
            vm.runInContext(scriptContent, sandbox);

            const state = sandbox.window.__INITIAL_STATE__;
            try {
                const products = state.listingAndSearchStoreData.data.listing.items;
                if (products && products.length > 0) {
                    console.log("TX ITEM DUMP:");
                    console.log(JSON.stringify(products[0], null, 2));
                } else {
                    console.log("No products found in listing.items");
                }
            } catch (e) {
                console.log("Error drilling down:", e);
                console.log("State keys:", Object.keys(state));
            }
        }
    }
    await browser.close();
})();
