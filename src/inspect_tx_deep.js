const fs = require('fs');
const vm = require('vm');

try {
    const html = fs.readFileSync('tx_category_dump.html', 'utf8');

    // Find the script tag content
    const startMarker = 'window.__INITIAL_STATE__ =';
    const startIndex = html.indexOf(startMarker);
    const scriptEndIndex = html.indexOf('</script>', startIndex);

    if (startIndex !== -1 && scriptEndIndex !== -1) {
        const scriptContent = html.substring(startIndex, scriptEndIndex);

        const sandbox = { window: {} };
        try {
            vm.runInNewContext(scriptContent, sandbox);
            const state = sandbox.window.__INITIAL_STATE__;

            const listingData = state.listingAndSearchStoreData;

            if (listingData) {
                console.log("Found listingAndSearchStoreData!");
                console.log("Keys:", Object.keys(listingData));

                // Check for products
                if (listingData.products) {
                    console.log(`Products Array Length: ${listingData.products.length}`);
                    if (listingData.products.length > 0) {
                        console.log("Sample Product (First Item):");
                        console.log(JSON.stringify(listingData.products[0], null, 2));
                    }
                } else if (listingData.items) {
                    console.log(`Items Array Length: ${listingData.items.length}`);
                    console.log("Sample Item:", JSON.stringify(listingData.items[0], null, 2));
                } else {
                    console.log("No explicit 'products' or 'items' key found. Dumping 1 level deep:");
                    for (const [key, value] of Object.entries(listingData)) {
                        if (Array.isArray(value)) {
                            console.log(`  ${key}: Array[${value.length}]`);
                            if (value.length > 0 && typeof value[0] === 'object') {
                                console.log(`    Sample: ${JSON.stringify(value[0]).substring(0, 100)}...`);
                            }
                        } else if (typeof value === 'object') {
                            console.log(`  ${key}: Object { ${Object.keys(value).join(', ')} }`);
                        } else {
                            console.log(`  ${key}: ${value}`);
                        }
                    }
                }
            } else {
                console.log("listingAndSearchStoreData is null or undefined.");
            }

        } catch (e) {
            console.error("VM Execution Error:", e.message);
        }
    }

} catch (e) {
    console.error("File Read Error:", e.message);
}
