const fs = require('fs');
const html = fs.readFileSync('lime-dump.html', 'utf8');

const regex = /<li[^>]*class="[^"]*\btype-product\b[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
let match = regex.exec(html);

if (match) {
    const tileHtml = match[0];
    console.log("Found Tile HTML:\n", tileHtml.substring(0, 1500)); // Print first 1500 chars 
    
    const aRegex = /<a[^>]*>/gi;
    let aMatch;
    console.log("\n--- Anchor Tags ---");
    while((aMatch = aRegex.exec(tileHtml)) !== null) {
        console.log(aMatch[0]);
    }
} else {
    console.log("No type-product found!");
}
