const fs = require('fs');

try {
    const html = fs.readFileSync('f54_debug.html', 'utf8');

    // Look for generic JSON-like structures assigned to window variables
    const regex = /window\.(\w+)\s*=\s*(\{.*?\}|\[.*?\]);/g;
    let match;
    let found = false;

    while ((match = regex.exec(html)) !== null) {
        const varName = match[1];
        const jsonStr = match[2];

        try {
            // fast parse check
            JSON.parse(jsonStr);
            console.log(`Found JSON variable: window.${varName} (Length: ${jsonStr.length})`);
            found = true;
            if (jsonStr.length > 500) {
                console.log("Snippet:", jsonStr.substring(0, 200) + "...");
            }
        } catch (e) {
            // ignore invalid json (might be JS code)
        }
    }

    if (!found) {
        console.log("No simple JSON assignments found. Searching for __pdictDataLayer...");
        const pdictIndex = html.indexOf('window.__pdictDataLayer =');
        if (pdictIndex !== -1) {
            console.log("Found __pdictDataLayer assignment!");
        }
    }

} catch (e) {
    console.error("Error reading file:", e);
}
