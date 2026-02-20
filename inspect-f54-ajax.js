const fs = require('fs');
const html = fs.readFileSync('f54-dump-ajax.html', 'utf8');

console.log('Total length:', html.length);
if (html.includes('Nike') || html.includes('Dunk')) {
    console.log('Found Nike or Dunk in HTML');
} else {
    console.log('Could NOT find Nike/Dunk in HTML. Are we blocked?');
}

const productClasses = html.match(/class="[^"]*(product-tile|item|card)[^"]*"/gi);
console.log(`Found ${productClasses ? productClasses.length : 0} product/item classes`);
if (productClasses) {
    console.log(productClasses.slice(0, 5));
}
