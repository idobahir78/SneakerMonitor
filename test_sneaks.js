const SneaksAPI = require('sneaks-api');
const sneaks = new SneaksAPI();

const TARGET_BRANDS = [
    "Nike",
    "Adidas",
    "Puma",
    "New Balance",
    "Asics",
    "Hoka",
    "On Running",
    "Saucony",
    "Jordan"
];

console.log("Testing sneaks-api for a brand...");

sneaks.getProducts("Nike", 20, function (err, products) {
    if (err) {
        console.error("Error:", err);
        return;
    }

    console.log(`Found ${products.length} products for Nike.`);

    const sample = products.slice(0, 5).map(p => ({
        shoeName: p.shoeName,
        brand: p.brand,
        silhoutte: p.silhoutte,
        colorway: p.colorway,
        description: p.description
    }));

    console.log(JSON.stringify(sample, null, 2));
});
