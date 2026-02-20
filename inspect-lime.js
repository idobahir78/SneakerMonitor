const fs = require('fs');
const html = fs.readFileSync('lime-dump.html', 'utf8');

console.log('Total length:', html.length);
if (html.includes('Nike') || html.includes('nike')) {
    console.log('Found Nike in HTML');
} else {
    console.log('Could NOT find Nike in HTML. Are we blocked?');
}

const productClasses = html.match(/class="[^"]*(product|item|card|col-)[^"]*"/gi);
console.log(`Found ${productClasses ? productClasses.length : 0} structural classes`);

if (html.includes('Cloudflare') || html.includes('Just a moment')) {
    console.log('WARNING: Cloudflare/Captcha detected.');
}

// Find elements with "product"
const idx = html.indexOf('product');
if (idx > -1) {
    console.log('Snippet around first "product":', html.substring(Math.max(0, idx - 100), Math.min(html.length, idx + 100)));
}
