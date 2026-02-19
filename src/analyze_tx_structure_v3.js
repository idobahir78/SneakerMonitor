const fs = require('fs');
const vm = require('vm');

try {
    const html = fs.readFileSync('tx_debug.html', 'utf8');
    const startMarker = 'window.__INITIAL_STATE__ =';
    const startIndex = html.indexOf(startMarker);

    if (startIndex !== -1) {
        // Find the end of the script tag
        const scriptEndIndex = html.indexOf('</script>', startIndex);

        if (scriptEndIndex !== -1) {
            let scriptContent = html.substring(startIndex, scriptEndIndex);

            const sandbox = { window: {} };

            try {
                // Execute the script snippet in a sandbox
                vm.runInNewContext(scriptContent, sandbox);

                const state = sandbox.window.__INITIAL_STATE__;

                if (state) {
                    console.log("✅ VM Evaluation Successful!");

                    // 1. Traverse to find products and dump keys
                    function findProducts(obj, path = '') {
                        if (path.length > 80) return;

                        if (Array.isArray(obj)) {
                            if (obj.length > 0) {
                                const sample = obj[0];
                                if (sample && typeof sample === 'object') {
                                    const keys = Object.keys(sample);
                                    // Look for items with ID/SKU which are likely products
                                    if (keys.includes('qty') || (keys.includes('id') && keys.includes('sku'))) {
                                        console.log(`\n🎯 CANDIDATE FOUND at path: '${path}' (Count: ${obj.length})`);
                                        console.log("Sample Keys:", JSON.stringify(keys));
                                        console.log("Sample Item FULL:", JSON.stringify(sample, null, 2).substring(0, 3000));
                                    }
                                }
                            }
                            return;
                        }

                        if (typeof obj === 'object' && obj !== null) {
                            for (const key in obj) {
                                if (['commonConfig', 'translations', 'menu', 'seo', 'cms-page'].includes(key)) continue;
                                findProducts(obj[key], path ? `${path}.${key}` : key);
                            }
                        }
                    }

                    console.log("\n--- Traversing State for Products ---");
                    findProducts(state);

                    // 2. Search for Brand/Attribute Maps
                    console.log("\n--- Searching for Brand/Attribute Definitions ---");
                    function findMaps(obj, depth = 0) {
                        if (depth > 6) return;
                        for (const key in obj) {
                            if (key === 'attributes' || key === 'filters' || key === 'brands' || key === 'configurable_options') {
                                console.log(`\nFound Potential Map '${key}' at depth ${depth}`);
                                // Safely print a snippet
                                try {
                                    console.log("Snippet:", JSON.stringify(obj[key]).substring(0, 500));
                                } catch (e) { }
                            }
                            if (typeof obj[key] === 'object' && obj[key] !== null) findMaps(obj[key], depth + 1);
                        }
                    }
                    findMaps(state);

                } else {
                    console.log("VM ran but window.__INITIAL_STATE__ is undefined.");
                }

            } catch (e) {
                console.error("VM Execution Error:", e.message);
            }
        }
    }
} catch (err) {
    console.error("File error:", err);
}
