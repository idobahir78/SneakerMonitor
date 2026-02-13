const fs = require('fs');
const path = 'C:\\Users\\Ido Bahir\\Documents\\Gemini\\SneakerMonitor\\debug_screenshots\\Terminal X_debug.html';

try {
    const html = fs.readFileSync(path, 'utf8');
    const match = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{.*?\});/);
    if (match) {
        const jsonStr = match[1];
        const data = JSON.parse(jsonStr);
        console.log('Keys in INITIAL_STATE:', Object.keys(data));

        // Check for products in likely places
        if (data.products) {
            console.log('Found data.products:', Object.keys(data.products).length, 'entries');
            // Print first product
            const firstId = Object.keys(data.products)[0];
            console.log('Sample Product:', JSON.stringify(data.products[firstId], null, 2));
        }

        if (data.category && data.category.products) {
            console.log('Found data.category.products');
        }

        // Search for "Puma" or "Lamelo" in the data to see where they are
        const jsonString = JSON.stringify(data);
        const pumaCount = (jsonString.match(/Puma/gi) || []).length;
        console.log('Occurrences of "Puma":', pumaCount);

    } else {
        console.log('Could not find window.__INITIAL_STATE__');
    }
} catch (e) {
    console.error(e);
}
