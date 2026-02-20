const fs = require('fs');
const html = fs.readFileSync('f54-dump-ajax.html', 'utf8');

// Find all matches of Dunk
let i = -1;
let count = 0;
while ((i = html.indexOf('Dunk', i + 1)) !== -1) {
    count++;
    if (count <= 3) {
        console.log("Context around 'Dunk':\n", html.substring(Math.max(0, i - 100), Math.min(html.length, i + 100)));
    }
}
console.log(`Total "Dunk" found: ${count}`);

console.log('Does it contain product-item?:', html.includes('product-item'));
console.log('Does it contain product-tile?:', html.includes('product-tile'));
console.log('Does it contain present-product?:', html.includes('present-product'));
