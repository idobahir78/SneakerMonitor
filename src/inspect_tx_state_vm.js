const fs = require('fs');
const vm = require('vm');

try {
    const html = fs.readFileSync('tx_category_dump.html', 'utf8');

    // Find the script tag content
    const startMarker = 'window.__INITIAL_STATE__ =';
    const startIndex = html.indexOf(startMarker);

    if (startIndex !== -1) {
        // Find closing script tag
        const scriptEndIndex = html.indexOf('</script>', startIndex);
        if (scriptEndIndex !== -1) {
            const scriptContent = html.substring(startIndex, scriptEndIndex);

            console.log("Extracted Script Length:", scriptContent.length);

            const sandbox = { window: {} };
            try {
                vm.runInNewContext(scriptContent, sandbox);
                const state = sandbox.window.__INITIAL_STATE__;
                console.log("VM Execution Successful.");
                console.log("Keys in State:", Object.keys(state));

                // Scan for products
                const keywords = ['products', 'items', 'catalog', 'listing', 'search', 'sku', 'hits'];

                function findKeys(obj, path = '') {
                    if (!obj || typeof obj !== 'object') return;
                    Object.keys(obj).forEach(key => {
                        const newPath = path ? `${path}.${key}` : key;
                        // Check if key matches keyword
                        if (keywords.some(k => key.toLowerCase().includes(k))) {
                            console.log(`Found relevant key: ${newPath}`);
                            if (Array.isArray(obj[key])) {
                                console.log(`  -> Array Length: ${obj[key].length}`);
                                if (obj[key].length > 0) {
                                    const sample = obj[key][0];
                                    // Print a clean sample (limit keys)
                                    const sampleKeys = Object.keys(sample).slice(0, 5);
                                    console.log(`  -> Sample keys: ${sampleKeys.join(', ')}`);
                                    console.log(`  -> Sample ID/Name: ${sample.id || sample.name || sample.sku || 'N/A'}`);
                                }
                            }
                        }

                        // Heuristic recursion: specific paths that look promising
                        // jsonapi, catalog, listing, etc.
                        const k = key.toLowerCase();
                        if (k === 'jsonapi' || k === 'catalog' || k === 'listing' || k === 'products' || k === 'data') {
                            if (path.split('.').length < 4) {
                                findKeys(obj[key], newPath);
                            }
                        }
                    });
                }

                findKeys(state);

            } catch (e) {
                console.error("VM Execution Error:", e.message);
                console.error("Script Sample:", scriptContent.substring(0, 100));
            }
        } else {
            console.log("Could not find closing </script> tag.");
        }
    } else {
        console.log("Could not find start marker.");
    }

} catch (e) {
    console.error("File Read Error:", e.message);
}
