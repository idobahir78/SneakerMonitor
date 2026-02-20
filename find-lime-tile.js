const fs = require('fs');
const html = fs.readFileSync('lime-dump.html', 'utf8');

const regex = /<li[^>]*class="[^"]*(product)[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
let match = regex.exec(html);

if (match) {
    const tileHtml = match[0];
    console.log("Found Tile HTML:\n", tileHtml);

    // Find a tags in this tile
    const aRegex = /<a[^>]*>/gi;
    let aMatch;
    while ((aMatch = aRegex.exec(tileHtml)) !== null) {
        console.log("A tag:", aMatch[0]);
    }
}
