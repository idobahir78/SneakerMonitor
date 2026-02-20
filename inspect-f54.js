const fs = require('fs');
const html = fs.readFileSync('f54-dump.html', 'utf8');

console.log('Total length:', html.length);
if (html.includes('Nike') || html.includes('Dunk')) {
    console.log('Found Nike or Dunk in HTML');
} else {
    console.log('Could NOT find Nike/Dunk in HTML. Are we blocked?');
}

if (html.includes('cloudflare') || html.includes('captcha') || html.includes('captcha-bypass')) {
    console.log('WARNING: Cloudflare/Captcha strings detected.');
}

const productClasses = html.match(/class="[^"]*(product|item|card)[^"]*"/gi);
console.log(`Found ${productClasses ? productClasses.length : 0} product/item classes`);
if (productClasses) {
    console.log(productClasses.slice(0, 5));
}
