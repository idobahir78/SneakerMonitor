const fs = require('fs');
const path = require('path');

const PARTIAL_FILE = process.argv[2];
const MAIN_FILE = path.join(__dirname, '../../frontend/public/data.json');

if (!PARTIAL_FILE || !fs.existsSync(PARTIAL_FILE)) {
    console.error("❌ Usage: node patch_results.js <partial-file.json>");
    process.exit(1);
}

try {
    const partialData = JSON.parse(fs.readFileSync(PARTIAL_FILE, 'utf8'));
    let mainData = {
        updatedAt: new Date().toISOString(),
        isRunning: true,
        results: []
    };

    if (fs.existsSync(MAIN_FILE)) {
        mainData = JSON.parse(fs.readFileSync(MAIN_FILE, 'utf8'));
    }

    // Update metadata if available in partial
    if (partialData.searchTerm) mainData.searchTerm = partialData.searchTerm;
    if (partialData.lastSearchTerm) mainData.lastSearchTerm = partialData.lastSearchTerm;
    if (partialData.lastSizeInput) mainData.lastSizeInput = partialData.lastSizeInput;

    // Merge results
    const newResults = partialData.results || [];
    const existingResults = mainData.results || [];

    // Combine and deduplicate by Link
    const combined = [...existingResults, ...newResults];
    const seen = new Set();
    const unique = combined.filter(item => {
        if (seen.has(item.link)) return false;
        seen.add(item.link);
        return true;
    });

    // Sort by price
    unique.sort((a, b) => a.price - b.price);

    mainData.results = unique;
    mainData.updatedAt = new Date().toISOString();
    // Keep isRunning: true because other groups might still be working
    // (The final merge-and-deploy will set it to false)
    mainData.isRunning = true;

    fs.writeFileSync(MAIN_FILE, JSON.stringify(mainData, null, 2));
    console.log(`✅ Patched ${newResults.length} results from ${PARTIAL_FILE} into ${MAIN_FILE}`);
    console.log(`📊 Total results now: ${unique.length}`);

} catch (e) {
    console.error("❌ Patch failed:", e.message);
    process.exit(1);
}
