const fs = require('fs');
const html = fs.readFileSync('f54-dump-ajax.html', 'utf8');

const regex = /data-gtm-product="([^"]+)"/g;
let match;
let count = 0;
while ((match = regex.exec(html)) !== null) {
    count++;
    if (count === 1) {
        const decoded = match[1].replace(/&quot;/g, '"');
        console.log("Found JSON:", decoded);
        try {
            console.log("Parsed:", JSON.parse(decoded));
        } catch (e) { console.error("Parse error", e.message); }
    }
}
console.log(`Total items found: ${count}`);
