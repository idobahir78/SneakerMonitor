const fs = require('fs');
const https = require('https');
const SneaksAPI = require('sneaks-api');
const sneaks = new SneaksAPI();

const TARGET_BRANDS = ["Nike", "Adidas", "Puma", "New Balance", "Asics", "Hoka", "On Running", "Saucony", "Jordan"];

console.log("Checking if we can bypass StockX protections by using FlightClub or GOAT via sneaks-api...");

// Try specifically GOAT or FlightClub using Sneaks API's built in functions since StockX is blocking us
sneaks.getProducts("Nike", 50, function (err, products) {
    if (err) {
        console.error("Sneaks API Error globally:", err);
    } else {
        console.log(`Success! Found ${products.length} products`);
        console.log("Sample:", products[0].shoeName);
    }
});

// We can also query a reliable static JSON list hosted on GitHub that is updated weekly by the community
const url = 'https://raw.githubusercontent.com/FermandaN/Sneaker-Database/main/sneakers.json';

https.get(url, (res) => {
    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => {
        try {
            const parsedData = JSON.parse(rawData);
            console.log(`\nSuccessfully fetched open DB! Found ${parsedData.length || Object.keys(parsedData).length} items.`);
        } catch (e) {
            console.error("\nFailed to parse GitHub JSON DB:", e.message);
        }
    });
}).on('error', (e) => {
    console.error(`\nGot error: ${e.message}`);
});
