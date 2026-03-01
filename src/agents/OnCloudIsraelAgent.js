const DOMNavigator = require('./DOMNavigator');

// On Cloud IL uses Algolia for search – we call the API directly (no Puppeteer needed)
// Algolia app discovered via browser network inspection: App=ML35QLWPOC
class OnCloudIsraelAgent extends DOMNavigator {
    constructor() {
        super('On Cloud IL', 'https://www.on.com/en-il');
    }

    async scrape(brand, model) {
        const brandLower = brand.toLowerCase();
        if (brandLower !== 'on' && brandLower !== 'on cloud' && brandLower !== 'on-running') return [];

        // Deduplicate model: "Cloud Cloud X" → "Cloud X"
        const words = model.trim().split(/\s+/);
        const uniqueWords = [];
        for (const word of words) {
            if (!uniqueWords.some(w => w.toLowerCase() === word.toLowerCase())) uniqueWords.push(word);
        }
        const cleanModel = uniqueWords.join(' ');

        try {
            // Direct Algolia REST API call – zero browser overhead
            const algoliaAppId = 'ML35QLWPOC';
            const algoliaApiKey = 'bff229776989d153121333c90db826b1';
            const algoliaUrl = `https://${algoliaAppId}-dsn.algolia.net/1/indexes/*/queries`;

            const payload = JSON.stringify({
                requests: [{
                    indexName: 'prod_products_en-il',
                    params: `query=${encodeURIComponent(cleanModel)}&hitsPerPage=20&filters=availability%3Ain_stock`
                }, {
                    // Fallback index name variant
                    indexName: 'prod_on_il_products',
                    params: `query=${encodeURIComponent(cleanModel)}&hitsPerPage=20`
                }]
            });

            const response = await fetch(algoliaUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Algolia-Application-Id': algoliaAppId,
                    'X-Algolia-API-Key': algoliaApiKey
                },
                body: payload
            });

            if (!response.ok) {
                console.warn(`[On Cloud IL] Algolia API error: ${response.status}. Falling back to DOM.`);
                return await this._domScrape(cleanModel);
            }

            const data = await response.json();
            const results = [];

            for (const res of data.results || []) {
                for (const hit of (res.hits || [])) {
                    const title = hit.name || hit.displayName || hit.title || '';
                    const price = parseFloat(hit.price?.value || hit.price || hit.currentPrice || 0);
                    const url = hit.url || hit.pdpUrl || `https://www.on.com/en-il/${hit.slug || ''}`;
                    const image = hit.image || hit.imageUrl || hit.squarishURL || '';
                    const sizes = (hit.sizes || []).filter(s => s.available).map(s => s.label || s.value);

                    if (title && price > 0) {
                        results.push({ raw_title: title, raw_price: price, raw_url: url, raw_image_url: image, raw_sizes: sizes });
                    }
                }
                if (results.length > 0) break; // Use first index that returns results
            }

            console.log(`[On Cloud IL] Algolia returned ${results.length} products`);
            if (results.length > 0) return results;

            // If Algolia returned 0, fall back to DOM scraping
            return await this._domScrape(cleanModel);
        } catch (err) {
            console.error(`[On Cloud IL] Scrape error: ${err.message}`);
            return await this._domScrape(cleanModel).catch(() => []);
        }
    }

    async _domScrape(model) {
        const query = encodeURIComponent(model);
        const searchUrl = `https://www.on.com/en-il/shop?query=${query}`;
        console.log(`[On Cloud IL] Falling back to DOM: ${searchUrl}`);

        if (!this.page) await this.init();

        await this.navigateWithRetry(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await new Promise(r => setTimeout(r, 5000));

        const products = await this.page.evaluate(() => {
            const results = [];
            const tiles = document.querySelectorAll('a[data-wk-name="productCardLink"], [class*="ProductCard"]');
            tiles.forEach(tile => {
                const ariaLabel = tile.getAttribute('aria-label') || '';
                const imgEl = tile.querySelector('img');
                const priceEl = tile.querySelector('[class*="price"], [class*="Price"]');
                const priceText = priceEl?.innerText || '0';
                const priceMatch = priceText.match(/(\d{3,5}\.?\d{0,2})/);

                if (ariaLabel) {
                    results.push({
                        raw_title: ariaLabel,
                        raw_price: priceMatch ? parseFloat(priceMatch[1]) : 0,
                        raw_url: tile.href || '',
                        raw_image_url: imgEl?.src || ''
                    });
                }
            });
            return results;
        });

        console.log(`[On Cloud IL] DOM fallback found ${products.length} products`);
        return products;
    }
}

module.exports = OnCloudIsraelAgent;
