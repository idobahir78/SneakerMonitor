const fs = require('fs');

try {
    const html = fs.readFileSync('f54_visual.html', 'utf8');

    console.log("F54 Visual Dump Analysis (Native):");
    console.log("Length:", html.length);

    // Naive regex for title
    const titleMatch = html.match(/<title>(.*?)<\/title>/);
    if (titleMatch) console.log("Title:", titleMatch[1]);

    // Check for product classes
    const productMatches = html.match(/class="[^"]*(product|item|card)[^"]*"/gi);
    if (productMatches) {
        console.log(`Found ${productMatches.length} generic product class matches.`);
        console.log("Sample:", productMatches.slice(0, 5));
    } else {
        console.log("No generic product classes found via Regex.");
    }

    // Check for price symbols
    if (html.includes('₪')) console.log("Found ₪ symbol.");
    else console.log("No ₪ symbol found.");

    // Check for JSON-LD
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
    if (jsonLdMatch) {
        console.log("Found JSON-LD!");
        console.log(jsonLdMatch[1].substring(0, 200) + "...");
    }

} catch (e) {
    console.error("Error:", e);
}
