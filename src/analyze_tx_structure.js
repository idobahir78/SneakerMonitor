const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Path to the artifact: ../debug_search_Terminal_X.html relative to this script (in src/)
const htmlPath = path.join(__dirname, '..', 'debug_search_Terminal_X.html');

try {
    if (!fs.existsSync(htmlPath)) {
        console.error(`CRITICAL: File not found at ${htmlPath}`);
        process.exit(1);
    }

    const html = fs.readFileSync(htmlPath, 'utf8');

    // Find start of the state object
    const identifier = 'window.__INITIAL_STATE__ = ';
    const startIndex = html.indexOf(identifier);

    if (startIndex === -1) {
        console.error("CRITICAL: Could not find window.__INITIAL_STATE__ pattern in the HTML.");
        process.exit(1);
    }

    // Move to the start of the JS object (the first '{' after identifier)
    let openBraceIndex = html.indexOf('{', startIndex);
    if (openBraceIndex === -1) {
        console.error("CRITICAL: Could not find starting brace '{' after identifier.");
        process.exit(1);
    }

    // ---------------------------------------------------------
    // Robust Brace Counting Algorithm
    // ---------------------------------------------------------
    let braceCount = 0;
    let jsonString = '';
    let foundEnd = false;

    for (let i = openBraceIndex; i < html.length; i++) {
        const char = html[i];
        if (char === '{') braceCount++;
        else if (char === '}') braceCount--;

        if (braceCount === 0) {
            jsonString = html.substring(openBraceIndex, i + 1);
            foundEnd = true;
            break;
        }
    }

    if (!foundEnd) {
        console.error("CRITICAL: Could not find matching closing brace for JSON object.");
        process.exit(1);
    }

    // ---------------------------------------------------------
    // Parsing & Analysis (using VM for JS Object Literals)
    // ---------------------------------------------------------
    console.log(`Extracted string length: ${jsonString.length}`);

    let state;
    try {
        const sandbox = {};
        // Assign to a variable in the sandbox
        vm.runInNewContext(`state = ${jsonString}`, sandbox);
        state = sandbox.state;
        console.log("JS Object Evaluation Success!");
    } catch (e) {
        console.error("JS Evaluation Error:", e.message);
        process.exit(1);
    }

    // ---------------------------------------------------------
    // Specific Inspection: listingAndSearchStoreData
    // ---------------------------------------------------------
    console.log("\n--- Inspection: listingAndSearchStoreData ---");
    const listing = state.listingAndSearchStoreData;

    if (listing) {
        console.log("Keys:", Object.keys(listing));

        // Check nesting
        if (listing.products) {
            console.log("Found 'products' directly in listingAndSearchStoreData");
            if (Array.isArray(listing.products)) {
                console.log("It is an array of length:", listing.products.length);
                if (listing.products.length > 0) {
                    console.log("First Item Keys:", Object.keys(listing.products[0]));
                }
            } else {
                console.log("Type:", typeof listing.products);
            }
        }

        if (listing.items) {
            console.log("Found 'items' directly in listingAndSearchStoreData");
            // ...
        }

        // Just recursively search inside *this* object to find array of objects
        console.log("\n--- Deep Search in listingAndSearchStoreData ---");
        function findArrays(obj, path) {
            if (!obj || typeof obj !== 'object') return;
            if (Array.isArray(obj)) {
                if (obj.length > 0 && typeof obj[0] === 'object') {
                    console.log(`[ARRAY FOUND] Path: ${path} | Length: ${obj.length}`);
                    console.log("Sample Keys:", Object.keys(obj[0]).slice(0, 10));
                }
                return;
            }
            Object.keys(obj).forEach(key => findArrays(obj[key], `${path}.${key}`));
        }
        findArrays(listing, 'listingAndSearchStoreData');

    } else {
        console.log("listingAndSearchStoreData is MISSING.");
    }

} catch (error) {
    console.error("Error analyzing file:", error.message);
}
