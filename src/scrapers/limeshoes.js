const BaseScraper = require('./base-scraper');
const SmartFilter = require('../utils/smart-filter');

class LimeShoesScraper extends BaseScraper {
    constructor(searchTerm) {
        // We initialize with a placeholder URL, then override it in scrape()
        super('Lime Shoes', 'https://limeshoes.co.il/');
        this.searchTerm = searchTerm;
    }

    async scrape(browser) {
        const page = await browser.newPage();
        await this.navigate(page); // Sets UA and Viewport

        try {
            console.log(`[Lime Shoes] Searching for "${this.searchTerm}" via AJAX API...`);

            // 1. Query the internal WooCommerce search API
            const ajaxUrl = `https://limeshoes.co.il/?wc-ajax=dgwt_wcas_ajax_search&s=${encodeURIComponent(this.searchTerm)}`;
            await page.goto(ajaxUrl, { waitUntil: 'networkidle2', timeout: 30000 });

            // 2. Parse the JSON response extraction
            const apiResponse = await page.evaluate(() => document.body.innerText);
            let data;
            try {
                data = JSON.parse(apiResponse);
            } catch (e) {
                console.error('[Lime Shoes] Failed to parse AJAX response', e);
            }

            // 3. Find a Category URL in the suggestions
            let targetUrl = null;

            if (data && data.suggestions) {
                const categoryMatch = data.suggestions.find(s =>
                    s.type === 'taxonomy' &&
                    s.taxonomy === 'product_cat' &&
                    s.url
                );

                if (categoryMatch) {
                    targetUrl = categoryMatch.url;
                    console.log(`[Lime Shoes] Found category match: ${targetUrl}`);
                }
            }

            if (!targetUrl) {
                console.log(`[Lime Shoes] No specific category found for "${this.searchTerm}". Failing over to Standard Search.`);
                // Fallback: Standard WooCommerce Search
                targetUrl = `https://limeshoes.co.il/?s=${encodeURIComponent(this.searchTerm)}&post_type=product`;
            }

            // 4. Navigate to the found Category Page OR Search Result Page
            console.log(`[Lime Shoes] Navigating to: ${targetUrl}`);
            await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

            // 5. Build parsed items
            const items = await this.parse(page, this.searchTerm);
            console.log(`[Lime Shoes] Found ${items.length} raw items.`);

            // 6. Apply Smart Filter
            const filteredItems = SmartFilter.filter(items, this.searchTerm);
            console.log(`[Lime Shoes] Final output: ${filteredItems.length} items (after Smart Filter).`);

            return filteredItems;

        } catch (error) {
            console.error(`[Lime Shoes] Error during scraping: ${error.message}`);
            return [];
        } finally {
            await page.close();
        }
    }

    // Reuse existing parse logic, but updated generic selectors slightly just in case
    async parse(page, brandName) {
        return await page.evaluate((storeName, brandName) => {
            const items = [];
            const elements = document.querySelectorAll('li.product, .product-grid-item, div.product-item');

            elements.forEach(el => {
                const titleEl = el.querySelector('.woocommerce-loop-product__title, .product-title, h3, h2, .name');
                const priceEls = el.querySelectorAll('.price bdi, .price .amount');
                const linkEl = el.querySelector('a.woocommerce-LoopProduct-link, a.product-link, a');

                if (titleEl && linkEl) {
                    const title = titleEl.innerText.trim();
                    let link = linkEl.href;
                    if (!link) link = linkEl.getAttribute('href');
                    let price = 0;

                    if (priceEls.length > 0) {
                        // Take the last price element (usually the sale price if multiple exist)
                        const priceText = priceEls[priceEls.length - 1].innerText;
                        price = parseFloat(priceText.replace(/[^\d.]/g, ''));
                    }

                    // Check for Out of Stock
                    const isOutOfStock = el.classList.contains('outofstock') ||
                        (el.innerText && el.innerText.includes('אזל במלאי'));

                    if (title && price && !isOutOfStock) {
                        items.push({
                            title,
                            price,
                            link,
                            store: storeName,
                            sizes: [],
                            brand: brandName // Injected context
                        });
                    }
                }
            });
            return items;
        }, this.storeName, brandName);
    }
}

module.exports = LimeShoesScraper;
