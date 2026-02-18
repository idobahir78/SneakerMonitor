const fs = require('fs');

try {
    const html = fs.readFileSync('tx_category_dump.html', 'utf8');
    const match = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{.*?\});/);

    if (match) {
        console.log("Found __INITIAL_STATE__!");
        const jsonStr = match[1];
        try {
            const state = JSON.parse(jsonStr);
            console.log("Keys in State:", Object.keys(state));

            // Check for potential product lists
            const keywords = ['products', 'items', 'catalog', 'listing', 'search', 'sku'];

            function findKeys(obj, path = '') {
                if (!obj || typeof obj !== 'object') return;
                Object.keys(obj).forEach(key => {
                    const newPath = path ? `${path}.${key}` : key;
                    if (keywords.some(k => key.toLowerCase().includes(k))) {
                        console.log(`Found relevant key: ${newPath}`);
                        // If array, print length
                        if (Array.isArray(obj[key])) {
                            console.log(`  -> Array Length: ${obj[key].length}`);
                            if (obj[key].length > 0) console.log(`  -> Sample:`, JSON.stringify(obj[key][0]).substring(0, 100) + '...');
                        } else if (typeof obj[key] === 'object') {
                            console.log(`  -> Object Keys: ${Object.keys(obj[key]).join(', ').substring(0, 100)}...`);
                        }
                    }
                    if (path.split('.').length < 3) { // Limit recursion depth
                        findKeys(obj[key], newPath);
                    }
                });
            }

            findKeys(state);

        } catch (e) {
            console.error("JSON Parse Error:", e.message);
            // Save bad JSON for inspection?
            fs.writeFileSync('tx_bad_json.txt', jsonStr);
        }
    } else {
        console.log("Could not find __INITIAL_STATE__ pattern.");
    }

} catch (e) {
    console.error("File Read Error:", e.message);
}
