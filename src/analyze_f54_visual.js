const fs = require('fs');
const cheerio = require('cheerio');

try {
    const html = fs.readFileSync('f54_visual.html', 'utf8');
    const $ = cheerio.load(html);

    console.log("F54 Visual Dump Analysis:");
    console.log("Title:", $('title').text());
    console.log("Body length:", html.length);

    // Check for product containers
    const products = $('.product-tile, .product-item, .card, [data-rubicon], [data-gtm-product]');
    console.log("Product candidates count:", products.length);

    // Check for JSON-LD
    $('script[type="application/ld+json"]').each((i, el) => {
        console.log(`JSON-LD ${i}:`, $(el).html().substring(0, 100) + "...");
    });

    // Check for large JS variables
    const regex = /var\s+(\w+)\s*=\s*(\{.*?\});/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
        if (match[2].length > 1000) {
            console.log(`Large JS Var: ${match[1]} (len ${match[2].length})`);
        }
    }

    // Check for __pdictDataLayer
    if (html.includes('__pdictDataLayer')) {
        console.log("Found __pdictDataLayer in text.");
    }

} catch (e) {
    console.error("Error:", e);
}
