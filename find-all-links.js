const fs = require('fs');
const html = fs.readFileSync('tx-dump.html', 'utf8');

const regex = /<a[^>]+href="([^">]+)"/g;
const links = new Set();
let match;
while ((match = regex.exec(html)) !== null) {
    links.add(match[1]);
}
console.log([...links].join('\n'));
