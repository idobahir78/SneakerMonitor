const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function debugStockX() {
    console.log("🕵️ Starting StockX Content Debug...");

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();

        // Set a realistic User Agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        await page.goto('https://stockx.com/search?s=Wade', { waitUntil: 'domcontentloaded' });

        // Wait a bit for potential JS loading or challenges
        await new Promise(r => setTimeout(r, 5000));

        const title = await page.title();
        console.log(`PAGE TITLE: ${title}`);

        const content = await page.content();
        fs.writeFileSync('stockx_debug.html', content);
        console.log("Saved HTML to stockx_debug.html");

        // Simple check for common block phrases
        if (title.includes("Just a moment") || title.includes("Challenge") || content.includes("pardon our interruption")) {
            console.log("⚠️ BLOCK DETECTED: Cloudflare/PerimeterX challenge active.");
        } else {
            console.log("✅ Page seems loaded. Checking for tiles in HTML...");
            const tileCount = (content.match(/product-tile/g) || []).length;
            console.log(`Found 'product-tile' string occurrences: ${tileCount}`);

            const wadeCount = (content.match(/Wade/gi) || []).length;
            console.log(`Found 'Wade' string occurrences: ${wadeCount}`);
        }

    } catch (error) {
        console.error("Error:", error);
    } finally {
        // Analyze if __NEXT_DATA__ exists and contains useful product info
        const nextData = await page.evaluate(() => {
            const script = document.getElementById('__NEXT_DATA__');
            if (!script) return null;
            try {
                return JSON.parse(script.innerHTML);
            } catch (e) {
                return { error: e.message };
            }
        });

        if (nextData) {
            console.log('__NEXT_DATA__ found!');

            // Save the raw JSON for inspection (optional, but good for debugging)
            fs.writeFileSync('stockx_data.json', JSON.stringify(nextData, null, 2));
            console.log('Saved stockx_data.json');

            // Attempt to find products in standard locations
            let products = [];
            try {
                // Check for search results in React Query state
                const dehydratedState = nextData.props?.pageProps?.dehydratedState;
                if (dehydratedState?.queries) {
                    dehydratedState.queries.forEach(q => {
                        if (q.state?.data?.browse?.results) {
                            products = q.state.data.browse.results;
                            console.log(`Found ${products.length} products in React Query state.`);
                        }
                    });
                }
            } catch (e) {
                console.log('Error traversing JSON:', e.message);
            }

            if (products.length > 0) {
                console.log('First product keys:', Object.keys(products[0]));
                if (products[0].variants) {
                    console.log('First product variants:', JSON.stringify(products[0].variants).substring(0, 200));
                } else {
                    console.log('No "variants" key in product object.');
                    // Check other potential keys for size info
                    // e.g. "traits", "children", "skus"
                }
            }
        } else {
            console.log('__NEXT_DATA__ NOT found in valid JSON format.');
        }

        await browser.close();
    }
}

debugStockX();
