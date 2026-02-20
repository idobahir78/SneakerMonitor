const fs = require('fs');
const html = fs.readFileSync('tx-dump.html', 'utf8');

const regex = /<a[^>]+href="([^">]+)"/g;
const links = [];
let match;
while ((match = regex.exec(html)) !== null) {
    if (match[1].startsWith('/') || match[1].includes('terminalx')) {
        links.push(match[1]);
    }
}
const uniqueLinks = [...new Set(links)];
console.log(uniqueLinks.filter(l => l.includes('.html') || l.includes('nike')).slice(0, 15));
