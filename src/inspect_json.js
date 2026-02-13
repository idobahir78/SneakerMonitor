
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// Adjust path to point to root where stockx_debug.html is
const htmlPath = path.join(__dirname, '..', 'stockx_debug.html');

try {
    const html = fs.readFileSync(htmlPath, 'utf8');
    const $ = cheerio.load(html);
    const nextDataScript = $('#__NEXT_DATA__');

    if (nextDataScript.length) {
        const jsonData = JSON.parse(nextDataScript.html());

        // Helper to check for products in deeply nested structure
        const findProducts = (obj, path = '') => {
            if (!obj) return;
            if (Array.isArray(obj)) {
                if (obj.length > 0 && obj[0] && (obj[0].browse || obj[0].title)) {
                    console.log(`[FOUND ARRAY] at ${path} with length ${obj.length}`);
                    // Inspect first item
                    console.log('Sample Item:', JSON.stringify(obj[0]).substring(0, 200));
                }
                obj.forEach((item, i) => {
                    if (typeof item === 'object') findProducts(item, `${path}[${i}]`);
                });
            } else if (typeof obj === 'object') {
                if (obj.browse) { // common key for search results
                    console.log(`[FOUND 'browse' KEY] at ${path}`);
                    if (obj.browse.results) {
                        console.log(`[FOUND 'results'] inside browse! Length: ${obj.browse.results.length}`);
                        // Check first result for sizes
                        const first = obj.browse.results[0];
                        console.log('First Product Keys:', Object.keys(first));
                        // Check specific fields
                        if (first.market) console.log('Market Data:', JSON.stringify(first.market));
                        if (first.variants) console.log('Variants:', JSON.stringify(first.variants)); // often contains sizes
                    }
                }
                Object.keys(obj).forEach(key => {
                    // recursive search but limited depth/keys to avoid infinite loop
                    if (key === 'props' || key === 'pageProps' || key === 'dehydratedState' || key === 'queries' || key === 'state' || key === 'data') {
                        findProducts(obj[key], `${path}.${key}`);
                    }
                });
            }
        };

        console.log('Parsing JSON structure...');
        findProducts(jsonData, 'root');

    } else {
        console.log('No __NEXT_DATA__ found.');
    }

} catch (e) {
    console.error('Error:', e.message);
}
