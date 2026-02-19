const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const SmartFilter = require('../utils/smart-filter');

class Factory54PuppeteerScraper {
    constructor(query) {
        this.query = query;
        this.storeName = 'Factory 54';
        this.baseUrl = 'https://www.factory54.co.il';
    }

    async scrape(browser) {
        console.log(`[Factory 54] Launching API Scrape for: ${this.query}`);
        let page;

        try {
            page = await browser.newPage();
            // Mimic real browser headers
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Referer': 'https://www.factory54.co.il/men',
                'X-Requested-With': 'XMLHttpRequest'
            });

            // Construct API URL
            const apiQuery = encodeURIComponent(this.query);
            const apiUrl = `https://www.factory54.co.il/on/demandware.store/Sites-factory54-Site/iw_IL/Search-Show?q=${apiQuery}&lang=iw_IL&start=0&sz=36&format=ajax`;

            console.log(`[Factory 54] Fetching API: ${apiUrl}`);
            const response = await page.goto(apiUrl, { waitUntil: 'networkidle2', timeout: 30000 });
            const html = await response.text();

            console.log(`[Factory 54] Response length: ${html.length}`);

            // Parse HTML using browser context (no Cheerio needed)
            const mappedProducts = await page.evaluate((html, baseUrl, storeName) => {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const tiles = doc.querySelectorAll('[data-gtm-product]');
                const results = [];

                tiles.forEach((el, index) => {
                    try {
                        let title = '';
                        let brand = storeName;
                        let price = 0;

                        // Try GTM data first (High Fidelity)
                        const gtmData = el.getAttribute('data-gtm-product');
                        if (gtmData) {
                            try {
                                const json = JSON.parse(gtmData);
                                if (json.item_name) title = json.item_name;
                                if (json.item_brand) brand = json.item_brand.toUpperCase();
                                if (json.price) price = parseFloat(json.price);
                            } catch (e) { /* ignore json error */ }
                        }

                        // Fallback Title
                        if (!title) {
                            const titleEl = el.querySelector('.pdp-link a') || el.querySelector('.link') || el.querySelector('.product-name');
                            title = titleEl ? titleEl.textContent.trim() : '';
                        }

                        // Fallback Brand
                        if (brand === storeName) {
                            const brandEl = el.querySelector('.product-brand');
                            if (brandEl) brand = brandEl.textContent.trim();
                        }

                        // Fallback Price
                        if (price === 0) {
                            let priceText = '';
                            const salesEl = el.querySelector('.sales .value');
                            const priceInverseEl = el.querySelector('.price-inverse');
                            const priceEl = el.querySelector('.price .value');

                            if (priceInverseEl) priceText = priceInverseEl.textContent.trim();
                            else if (salesEl) priceText = salesEl.getAttribute('content') || salesEl.textContent.trim();
                            else if (priceEl) priceText = priceEl.textContent.trim();

                            price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
                        }

                        let link = '';
                        const linkEl = el.querySelector('.pdp-link a') || el.querySelector('a.link');
                        if (linkEl) {
                            let href = linkEl.getAttribute('href');
                            if (href) {
                                if (href.startsWith('http')) link = href;
                                else link = baseUrl + href;
                            }
                        }

                        let image = '';
                        const imgEl = el.querySelector('.product-tile-image') || el.querySelector('img.tile-image');
                        if (imgEl) {
                            image = imgEl.getAttribute('src') || imgEl.getAttribute('data-src');
                            if (image && !image.startsWith('http')) image = baseUrl + image;
                        }

                        if (title && !isNaN(price)) {
                            results.push({
                                title,
                                price,
                                store: storeName,
                                link,
                                image,
                                brand: brand
                            });
                        }
                    } catch (err) {
                        // Silent fail
                    }
                });
                return results;
            }, html, this.baseUrl, this.storeName);

            console.log(`[Factory 54] Mapped ${mappedProducts.length} items.`);

            // --- SMART FILTER ---
            const filtered = SmartFilter.filter(mappedProducts, this.query);
            console.log(`[Factory 54] Final output: ${filtered.length} products.`);

            return filtered;

        } catch (e) {
            console.error("[Factory 54] Scrape failed:", e.message);
            return [];
        } finally {
            if (page) await page.close();
        }
    }
}

module.exports = Factory54PuppeteerScraper;
