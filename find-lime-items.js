const fs = require('fs');
const html = fs.readFileSync('lime-dump.html', 'utf8');

// The search results are typically in a ul/div loop
const regex = /class="[^"]*(product|item)[^"]*"/gi;
const matches = [];
let match;
while ((match = regex.exec(html)) !== null) {
    if (!matches.includes(match[0])) {
        matches.push(match[0]);
    }
}
console.log("Unique product/item related classes:");
console.log(matches.slice(0, 20));

// Let's find any a tag with an href containing 'product'
const hrefRegex = /<a[^>]+href="([^"]+)"[^>]*>/gi;
const links = new Set();
while ((match = hrefRegex.exec(html)) !== null) {
    if (match[1].includes('/product/')) {
        links.add(match[1]);
    }
}
console.log(`\nFound ${links.size} product links.`);
if (links.size > 0) {
    console.log(Array.from(links).slice(0, 5));
}
