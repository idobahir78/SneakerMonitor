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
            console.log("Found listingAndSearchStoreData.data!");
            console.log("Keys:", Object.keys(data));

            // Inspect 'listing'
            if (data.listing) {
                console.log("\n--- data.listing ---");
                console.log("Keys:", Object.keys(data.listing));
                if (data.listing.items) {
                    console.log(`Items Array Length: ${data.listing.items.length}`);
                    if (data.listing.items.length > 0) {
                        console.log("Sample Item (First):");
                        console.log(JSON.stringify(data.listing.items[0], null, 2));
                    }
                } else if (data.listing.products) {
                    console.log(`Products Array Length: ${data.listing.products.length}`);
                    if (data.listing.products.length > 0) {
                        console.log("Sample Product (First):");
                        console.log(JSON.stringify(data.listing.products[0], null, 2));
                    }
                }
            }

            // Inspect 'category' just in case
            if (data.category) {
                console.log("\n--- data.category ---");
                console.log("Keys:", Object.keys(data.category));
            }
        }
    }
} catch (e) {
    console.error("Error:", e.message);
}
