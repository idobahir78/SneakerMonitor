const fs = require('fs');
const vm = require('vm');
const util = require('util');

try {
    const html = fs.readFileSync('tx_category_dump.html', 'utf8');
    const startMarker = 'window.__INITIAL_STATE__ =';
    const startIndex = html.indexOf(startMarker);
    const scriptEndIndex = html.indexOf('</script>', startIndex);

    if (startIndex !== -1 && scriptEndIndex !== -1) {
        const scriptContent = html.substring(startIndex, scriptEndIndex);
        const sandbox = { window: {} };
        vm.runInNewContext(scriptContent, sandbox);
        const state = sandbox.window.__INITIAL_STATE__;

        try {
            const products = state.listingAndSearchStoreData.data.listing.products;
            if (products && products.length > 0) {
                const p = products[0];
                console.log(util.inspect(p, { showHidden: false, depth: null, colors: false }));
            } else {
                console.log("Products array is empty or undefined.");
            }
        } catch (e) {
            console.log("Error accessing products:", e.message);
        }
    }
} catch (e) {
    console.error("Error:", e.message);
}
