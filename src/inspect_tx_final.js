const fs = require('fs');
const vm = require('vm');

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

        const data = state.listingAndSearchStoreData.data;

        if (data) {
            console.log("--- listingAndSearchStoreData.data ---");

            if (data.category) {
                console.log(`Category Product Count: ${data.category.product_count}`);
                console.log(`Category Name: ${data.category.name}`);
            }

            if (data.listing) {
                console.log(`Listing Products Type: ${typeof data.listing.products}`);
                console.log(`Listing Products Value:`, data.listing.products);
                console.log(`Search Term: ${data.listing.searchTerm}`);
                console.log(`Is Search Mode: ${data.listing.isSearchMode}`);
            }
        }
    }
} catch (e) {
    console.error("Error:", e.message);
}
