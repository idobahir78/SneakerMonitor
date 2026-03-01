const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();

chromium.use(stealth);

const BRAND_CONFIG = {
    'Nike': { urls: ['https://www.nike.com/w/mens-shoes-nik1zy7ok'], sel: '.product-card__title' },
    'Puma': { urls: ['https://us.puma.com/us/en/men/shoes', 'https://us.puma.com/us/en/sports/basketball/shoes'], sel: '[data-test-id="product-list-item-title"], .tw-xwxa0o' },
    'Adidas': { urls: ['https://www.adidas.com/us/en/men-shoes'], sel: '.gl-product-card__title' },
    'New Balance': { urls: ['https://www.newbalance.com/men/shoes/'], sel: '.product-name' },
    'Asics': { urls: ['https://www.asics.com/us/en-us/mens-shoes/c/aa10000000/'], sel: '.product-name' }
};

async function autoScroll(page) {
    for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight / 3));
        await page.waitForTimeout(1500);
    }
}

async function scrapeOfficialSites() {
    console.log('\n🤖 Starting Official First-Party Brand Scraper (Playwright)...');

    const results = {};
    const browser = await chromium.launch({ headless: true });

    try {
        const context = await browser.newContext({
            viewport: { width: 1920, height: 1080 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            extraHTTPHeaders: {
                'Accept-Language': 'en-US,en;q=0.9',
                'Sec-Fetch-Site': 'same-origin',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-User': '?1',
                'Sec-Fetch-Dest': 'document'
            }
        });

        for (const [brand, config] of Object.entries(BRAND_CONFIG)) {
            console.log(`\nnavigate > ${brand} Official Store...`);
            results[brand] = new Set();

            for (const url of config.urls) {
                const page = await context.newPage();

                try {
                    // Added random masking to avoid Cloudflare bot checks
                    await page.addInitScript(() => {
                        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                    });

                    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    if (res && res.status() < 400) {
                        await page.waitForTimeout(3000);
                        await autoScroll(page);

                        // Generic selector attempting to harvest any linked product title or h1/h2/h3 card title
                        const titles = await page.$$eval(
                            config.sel,
                            nodes => nodes.map(n => n.innerText || n.textContent)
                        );

                        titles.forEach(t => {
                            if (!t) return;
                            let name = t.trim().replace(/\n/g, ' ');

                            const rejectWords = ['sandal', 'slide', 'boot', 'shirt', 'pant', 'short', 'hoodie', 'jacket', 'sock', 'hat', 'cap', 'cleat', 'spike', 'apparel', 'clothing', 'tee', 'jersey', 'tank', 'legging', 'tight', 'bra', 'bag', 'backpack', 'flip flop'];

                            // Clean up generic marketing fluff that might appear in H3s
                            if (name.length > 4 && name.length < 60 &&
                                !name.toLowerCase().includes('shoes') &&
                                !name.toLowerCase().includes('sneakers') &&
                                !name.toLowerCase().includes('running') &&
                                !name.toLowerCase().includes('mens') &&
                                !rejectWords.some(word => name.toLowerCase().includes(word))) {

                                // Strip out the brand itself from the string
                                const brandRegex = new RegExp(`^${brand}\\s`, 'i');
                                name = name.replace(brandRegex, '').trim();

                                // Nike strips
                                name = name.replace(/By You/i, '').trim();
                                name = name.replace(/^Jordan\s/i, '').trim();

                                results[brand].add(name);
                            }
                        });
                        console.log(`✅ ${brand} URL Scraped (${url}): Found cumulative ${results[brand].size} models directly from store.`);
                    } else {
                        console.log(`❌ ${brand} Blocked or failed on ${url} (Status ${res ? res.status() : 'Unknown'})`);
                    }
                } catch (e) {
                    console.log(`⚠️ ${brand} timeout or navigation error on ${url}: ${e.message}`);
                } finally {
                    await page.close();
                }
            }
        }
    } finally {
        await browser.close();
    }

    // Convert Sets to Arrays
    const cleanedResults = {};
    for (const brand in results) {
        cleanedResults[brand] = Array.from(results[brand]);
    }

    return cleanedResults;
}

module.exports = { scrapeOfficialSites };

// If run directly for testing:
if (require.main === module) {
    scrapeOfficialSites()
        .then(result => {
            console.log("\n🧪 Final Test Output:");
            for (const [brand, models] of Object.entries(result)) {
                console.log(`- ${brand}: ${models.length} models`);
                if (models.length > 0) console.log(`  Sample: ${models.slice(0, 3).join(', ')}`);
            }
        })
        .catch(console.error);
}
