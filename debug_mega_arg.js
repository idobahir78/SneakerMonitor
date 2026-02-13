const MegaSportScraper = require('./src/scrapers/mega-sport');

const input = "Wade";
console.log(`Instantiating with: "${input}"`);

const scraper = new MegaSportScraper(input);
console.log(`Scraper searchTerm: "${scraper.searchTerm}"`);

if (scraper.searchTerm !== input) {
    console.error("FAIL: searchTerm mismatch!");
} else {
    console.log("PASS: searchTerm matches.");
}
