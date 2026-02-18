const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../debug_search_Terminal_X.html');

try {
    const html = fs.readFileSync(filePath, 'utf8');
    const match = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/);

    if (match && match[1]) {
        console.log('Found State JSON. Parsing...');
        // Clean up potential JS artifacts if needed, but usually regex captures the object
        // strict JSON parse might fail if keys aren't quoted, so we use eval logic similar to scraper
        const safeEval = new Function('return ' + match[1]);
        const state = safeEval();

        console.log('Root Keys:', Object.keys(state));

        if (state.catalog) {
            console.log('state.catalog keys:', Object.keys(state.catalog));
            if (state.catalog.products) {
                console.log('state.catalog.products type:', typeof state.catalog.products);
                if (typeof state.catalog.products === 'object') {
                    const vals = Object.values(state.catalog.products);
                    console.log('state.catalog.products count:', vals.length);
                    if (vals.length > 0) console.log('Sample Product:', JSON.stringify(vals[0], null, 2));
                }
            }
        }

        if (state.listingAndSearchStoreData) {
            console.log('state.listingAndSearchStoreData:', JSON.stringify(state.listingAndSearchStoreData, null, 2).substring(0, 500) + '...');
        }

    } else {
        console.log('Could not find window.__INITIAL_STATE__ in HTML');
    }
} catch (e) {
    console.error('Error:', e);
}
