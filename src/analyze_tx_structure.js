const fs = require('fs');

try {
    const html = fs.readFileSync('tx_debug.html', 'utf8');
    const startMarker = 'window.__INITIAL_STATE__ =';
    const startIndex = html.indexOf(startMarker);

    if (startIndex !== -1) {
        // Find the first opening brace after the marker
        const openBraceIndex = html.indexOf('{', startIndex);

        if (openBraceIndex !== -1) {
            let braceCount = 1;
            let currentIndex = openBraceIndex + 1;

            // Advance until braceCount returns to 0
            while (braceCount > 0 && currentIndex < html.length) {
                if (html[currentIndex] === '{') braceCount++;
                else if (html[currentIndex] === '}') braceCount--;
                currentIndex++;
            }

            if (braceCount === 0) {
                const jsonString = html.substring(openBraceIndex, currentIndex);
                try {
                    const state = JSON.parse(jsonString);
                    console.log("✅ JSON Parsed Successfully!");
                    console.log("State Root Keys:", Object.keys(state));

                    // Helper to recursively find objects that look like products
                    // A product usually has: name, price, brand, sku/id, image
                    function findProducts(obj, path = '') {
                        if (path.length > 80) return; // limit depth

                        if (Array.isArray(obj)) {
                            if (obj.length > 0) {
                                const sample = obj[0];
                                // Heuristic for a product object
                                if (sample && typeof sample === 'object') {
                                    // Check for typical product keys
                                    const keys = Object.keys(sample).join(',').toLowerCase();
                                    const hasName = keys.includes('name') || keys.includes('title');
                                    const hasPrice = keys.includes('price');
                                    const hasImage = keys.includes('image') || keys.includes('thumb');

                                    if (hasName && (hasPrice || hasImage)) {
                                        console.log(`\n🎯 CANDIDATE FOUND at path: '${path}' (Count: ${obj.length})`);
                                        console.log("Sample Items Keys:", Object.keys(sample));
                                        console.log("Sample Item:", JSON.stringify(sample, null, 2).substring(0, 500) + "...");
                                    }
                                }
                            }
                            return;
                        }

                        if (typeof obj === 'object' && obj !== null) {
                            for (const key in obj) {
                                // Skip huge configuration chunks to save time
                                if (['commonConfig', 'translations', 'menu', 'seo'].includes(key)) continue;
                                findProducts(obj[key], path ? `${path}.${key}` : key);
                            }
                        }
                    }

                    console.log("\n--- Traversing State for Products ---");
                    findProducts(state);

                } catch (e) {
                    console.error("JSON Parse Error:", e.message);
                }
            } else {
                console.log("Brace counting failed to find closing brace.");
            }
        } else {
            console.log("Could not find opening brace after marker.");
        }
    } else {
        console.log("Could not find start marker '__INITIAL_STATE__'.");
    }
} catch (err) {
    console.error("File read error:", err);
}
