const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const OUTPUT_FILE = path.join(__dirname, '../../frontend/src/data/brands.js');
const SITEMAP_INDEX = 'https://shoesonline.co.il/sitemap_index.xml';
const SCAN_LAST_N_SITEMAPS = 5;

const TARGET_BRANDS = ['Nike', 'Adidas', 'Jordan', 'New Balance', 'Puma', 'Under Armour', 'Asics', 'Hoka', 'On Cloud', 'Saucony'];
let collectedModels = {};
TARGET_BRANDS.forEach(b => collectedModels[b] = new Set());

(async () => {
    console.log('🚀 Starting Sitemap Discovery (via Stealth Puppeteer)...');

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Set view size and user agent to look real
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Helper to fetch page content (XML)
    async function fetchSitemapContent(url) {
        try {
            console.log(`   Navigating to ${url}...`);
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

            // XML might be rendered or just text. Get content.
            const content = await page.content();

            // Sometimes browsers apply style to XML, making it HTML.
            // We just need to extract the raw text/URLs or parse the HTML structure if it changed.
            // But usually page.content() gives the serialized HTML of the XML view.
            return content;
        } catch (e) {
            console.error(`   Failed to load ${url}: ${e.message}`);
            return '';
        }
    }

    try {
        // 1. Fetch Index
        const indexContent = await fetchSitemapContent(SITEMAP_INDEX);

        // 2. Extract Product Sitemaps
        // Chrome viewing XML wraps it in HTML mostly, but the URLs are there.
        // Look for URLs ending in product-sitemapX.xml
        // Regex: https://shoesonline.co.il/product-sitemap\d+.xml
        const productSitemapRegex = /https:\/\/shoesonline\.co\.il\/product-sitemap\d+\.xml/gi;
        let match;
        const sitemaps = new Set();
        while ((match = productSitemapRegex.exec(indexContent)) !== null) {
            sitemaps.add(match[0]);
        }

        const sitemapList = Array.from(sitemaps);
        console.log(`Found ${sitemapList.length} product sitemaps.`);

        // Sort
        sitemapList.sort((a, b) => {
            const numA = parseInt(a.match(/sitemap(\d+)/)[1]);
            const numB = parseInt(b.match(/sitemap(\d+)/)[1]);
            return numB - numA;
        });

        // 3. Process recent sitemaps
        const sitemapsToScan = sitemapList.slice(0, SCAN_LAST_N_SITEMAPS);
        console.log(`Scanning top ${sitemapsToScan.length} recent sitemaps...`);

        for (const sitemapUrl of sitemapsToScan) {
            const xml = await fetchSitemapContent(sitemapUrl);

            // Extract titles.
            // In Chrome XML view, titles might be just text or inside specific tags depending on how it's rendered.
            // But often the raw source is available if we don't let it render?
            // Actually, page.goto parses it.
            // Let's rely on finding "image:title" text if it exists, or just parsing the text content carefully.

            // Better strategy: Use evaluate to get text content if it's an XML document object,
            // OR regex the page.content() which includes all text.

            // Note: If Puppeteer renders XML, it might be inside <div class="collapsible-content"> etc.
            // Just regexing the whole HTML string for typical XML patterns usually works.

            // Fix: decoded entities
            const cleanXml = xml.replace(/&amp;/g, '&').replace(/&#8217;/g, "'");

            const imgTitleRegex = /image:title>(.*?)<\/image:title/gi;
            // Also try finding standard URLs that might contain title info?
            // No, titles are best.

            let titleMatch;
            let count = 0;
            while ((titleMatch = imgTitleRegex.exec(cleanXml)) !== null) {
                parseModelsFromTitle(titleMatch[1]);
                count++;
            }
            console.log(`      Extracted ${count} titles.`);
        }

        // 4. Save Results
        const finalData = {};
        let totalCount = 0;
        for (const brand of TARGET_BRANDS) {
            const models = Array.from(collectedModels[brand]).sort();
            finalData[brand] = models;
            totalCount += models.length;
            console.log(`   ${brand}: ${models.length} models`);
        }

        const fileContent = `const BRANDS_DATA = ${JSON.stringify(finalData, null, 4)};\n\nexport default BRANDS_DATA;`;
        fs.writeFileSync(OUTPUT_FILE, fileContent);
        console.log(`\n🎉 Updated ${OUTPUT_FILE} with ${totalCount} models!`);

    } catch (e) {
        console.error("Critical Error:", e);
    } finally {
        await browser.close();
    }
})();

function parseModelsFromTitle(fullTitle) {
    if (!fullTitle) return;
    const title = fullTitle.replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (title.includes('₪')) return;

    for (const brand of TARGET_BRANDS) {
        if (title.toLowerCase().includes(brand.toLowerCase())) {
            const regex = new RegExp(`${brand}\\s*`, 'i');
            let model = title.replace(regex, '').trim();
            model = model.split('|')[0].trim();
            model = model.replace(/WOMEN|MEN|YOUTH|KIDS/gi, '').trim();
            model = model.replace(/^-\s*/, '').trim();
            model = model.replace(/Shoesonline/gi, '').trim();
            model = model.replace(/נעלי|גברים|נשים|ילדים/g, '').trim();

            if (model.length < 2) continue;

            const words = model.split(' ');
            if (words.length > 3) model = words.slice(0, 3).join(' ');

            model = model.replace(/^[^a-zA-Z0-9]+/, '');

            if (model && model.length > 1) {
                collectedModels[brand].add(model);
            }
        }
    }
}
