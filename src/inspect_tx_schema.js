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

        const products = state.listingAndSearchStoreData.data.listing.products;

        if (products && products.length > 0) {
            const p = products[0];
            console.log("--- Refined Product Schema ---");
            console.log("ID:", p.id);
            console.log("SKU:", p.sku);
            console.log("Brand:", p.brand);
            console.log("Brand URL Object:", JSON.stringify(p.brand_url, null, 2));
            console.log("Description Object:", JSON.stringify(p.description, null, 2));
            console.log("Price Range Object:", JSON.stringify(p.price_range, null, 2));
            console.log("Image Object:", JSON.stringify(p.image, null, 2));
            console.log("Thumbnail Object:", JSON.stringify(p.thumbnail, null, 2));
            console.log("URL Path:", p.url_key); // Guessing url key
        }
    }
} catch (e) {
    console.error("Error:", e.message);
}
