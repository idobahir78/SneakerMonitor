const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('debug_search_ShoesOnline.html', 'utf8');
const $ = cheerio.load(html);

console.log('--- Inspecting ShoesOnline HTML ---');

// Common WooCommerce selectors
const selectors = [
    'li.product',
    'div.product',
    '.type-product',
    '.products .product',
    '.product-grid-item',
    '.item'
];

selectors.forEach(sel => {
    const count = $(sel).length;
    console.log(`Selector "${sel}": ${count} found`);
    if (count > 0) {
        // Print first item structure
        console.log(`First "${sel}" HTML:`);
        console.log($(sel).first().html().substring(0, 500));

        // Try to find title and price in the first item
        const el = $(sel).first();
        console.log('Title:', el.find('h2, .woocommerce-loop-product__title, .product-title, .name').text().trim());
        console.log('Price:', el.find('.price').text().trim());
    }
});
