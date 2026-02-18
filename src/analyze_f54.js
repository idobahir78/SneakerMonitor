const fs = require('fs');

try {
    const html = fs.readFileSync('f54_dump.html', 'utf8');
    console.log("Read F54 Dump. Length:", html.length);

    // 1. Check for State Injection
    const stateMatches = html.match(/window\.__INITIAL_STATE__\s*=/);
    if (stateMatches) console.log("Found window.__INITIAL_STATE__");
    else console.log("No window.__INITIAL_STATE__ found.");

    // 2. Check for Universal Variable (SFCC)
    if (html.includes('universal_variable')) console.log("Found universal_variable (SFCC?)");

    // 3. Check for JSON-LD
    const jsonLdMatches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
    if (jsonLdMatches) {
        console.log(`Found ${jsonLdMatches.length} JSON-LD blocks.`);
        jsonLdMatches.forEach((block, i) => {
            if (block.includes('"Product"') || block.includes('"ItemList"')) {
                console.log(`JSON-LD #${i} seems relevant.`);
                console.log(block.substring(0, 200) + '...');
            }
        });
    }

    // 4. Check DOM Selectors (Heuristic)
    if (html.includes('class="product-item"')) console.log("Found .product-item");
    if (html.includes('class="item"')) console.log("Found .item");
    if (html.includes('data-product-id')) console.log("Found data-product-id");

} catch (e) {
    console.error("Error reading F54 dump:", e.message);
}
