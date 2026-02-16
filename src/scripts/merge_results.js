const fs = require('fs');
const path = require('path');

const OUTPUT_PATH = path.join(__dirname, '../../frontend/public/data.json');
const INPUT_DIR = path.join(__dirname, '../../'); // Root or where artifacts are downloaded

// Find all data-part-*.json files
const files = fs.readdirSync(INPUT_DIR).filter(f => f.match(/^data-part-\d+\.json$/));

if (files.length === 0) {
    console.error("❌ No partial data files found!");
    process.exit(1);
}

console.log(`Found ${files.length} partial files: ${files.join(', ')}`);

let finalData = {
    updatedAt: new Date().toISOString(),
    isRunning: false,
    searchTerm: "",
    lastSizeInput: "",
    filters: { sizes: [] },
    results: []
};

files.forEach(file => {
    try {
        const content = fs.readFileSync(path.join(INPUT_DIR, file), 'utf8');
        const data = JSON.parse(content);

        // Merge Metadata (Aggregate from any file that has it)
        if (!finalData.searchTerm && data.searchTerm) finalData.searchTerm = data.searchTerm;
        if (!finalData.lastSearchTerm && data.lastSearchTerm) finalData.lastSearchTerm = data.lastSearchTerm;
        if (!finalData.lastSizeInput && data.lastSizeInput) finalData.lastSizeInput = data.lastSizeInput;
        if (finalData.filters.sizes.length === 0 && data.filters && data.filters.sizes) {
            finalData.filters.sizes = data.filters.sizes;
        }

        // Merge Results
        if (Array.isArray(data.results)) {
            finalData.results = finalData.results.concat(data.results);
        }
    } catch (e) {
        console.error(`Error parsing ${file}:`, e.message);
    }
});

// Deduplicate results based on Link
const uniqueResults = [];
const seenLinks = new Set();

finalData.results.forEach(item => {
    if (!seenLinks.has(item.link)) {
        seenLinks.add(item.link);
        uniqueResults.push(item);
    }
});

finalData.results = uniqueResults;
// Sort again by price just in case
finalData.results.sort((a, b) => a.price - b.price);

console.log(`✅ Merged ${finalData.results.length} total items.`);

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(finalData, null, 2));
console.log(`🎉 Saved merged data to: ${OUTPUT_PATH}`);
