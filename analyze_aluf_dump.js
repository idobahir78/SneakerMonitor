const fs = require('fs');

const content = fs.readFileSync('aluf_puppeteer.html', 'utf8');

console.log(`File Size: ${content.length} characters`);
console.log(`First 200 chars: ${content.substring(0, 200)}`);
console.log(`Last 200 chars: ${content.substring(content.length - 200)}`);

const hasNike = content.includes('Nike');
console.log(`Contains "Nike": ${hasNike}`);

const hasProduct = content.includes('product');
console.log(`Contains "product": ${hasProduct}`);

if (hasNike) {
    const idx = content.indexOf('Nike');
    console.log(`Context around "Nike": ${content.substring(idx - 100, idx + 100)}`);
}

// Extract some classes to see what structure we have
const classRegex = /class=["']([^"']+)["']/g;
let match;
const classes = new Set();
let count = 0;
while ((match = classRegex.exec(content)) !== null) {
    classes.add(match[1]);
    count++;
    if (count > 20) break; // just get first 20
}
console.log('Sample Classes:', Array.from(classes));
