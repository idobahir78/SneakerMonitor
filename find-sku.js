const fs = require('fs');
const html = fs.readFileSync('tx-dump.html', 'utf8');

// find W595000013 anywhere in the html
const idxs = [];
let i = -1;
while ((i = html.indexOf('W595000013', i + 1)) !== -1) {
    idxs.push(i);
}

const slices = idxs.map(idx => html.substring(Math.max(0, idx - 150), idx + 150));
console.log(`Found ${idxs.length} occurrences`);
console.log(slices.join('\n\n---\n\n'));
