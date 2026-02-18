const BaseScraper = require('./base-scraper');

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
                return [];
            }

            // 3. Find a Category URL in the suggestions
            // The API returns mixed results (products, categories, etc.). We prefer a specific brand category if available.
            let targetUrl = null;

            if (data && data.suggestions) {
                // Look for a taxonomy term (category/brand) that matches our query
                const categoryMatch = data.suggestions.find(s =>
                    s.type === 'taxonomy' &&
                    s.taxonomy === 'product_cat' &&
                    s.url
                );

                if (categoryMatch) {
                    targetUrl = categoryMatch.url;
                    console.log(`[Lime Shoes] Found category match: ${targetUrl}`);
                }
                // Fallback: If no category, check if there are direct product links? 
                // The current issue is that standard search fails. If we can't find a category, we might be stuck.
                // But for "Nike", "Adidas", etc., this API usually returns a brand category.
            }

            if (!targetUrl) {
                console.log(`[Lime Shoes] No specific category found for "${this.searchTerm}". Aborting to avoid broken search page.`);
                return [];
            }

            // 4. Navigate to the found Category Page
            console.log(`[Lime Shoes] Navigating to: ${targetUrl}`);
            await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

            // 5. Build parsed items from the Category Page
            const items = await this.parse(page);
            console.log(`[Lime Shoes] Found ${items.length} items.`);
            return items;

        } catch (error) {
            console.error(`[Lime Shoes] Error during scraping: ${error.message}`);
            return [];
        } finally {
            await page.close();
        }
    }

    // Reuse existing parse logic, but updated generic selectors slightly just in case
    async parse(page) {
        return await page.evaluate(() => {
            const items = [];
            const elements = document.querySelectorAll('li.product, .product-grid-item, div.product-item');

            elements.forEach(el => {
                const titleEl = el.querySelector('.woocommerce-loop-product__title, .product-title, h3, h2, .name');
                const priceEls = el.querySelectorAll('.price bdi, .price .amount');
                const linkEl = el.querySelector('a.woocommerce-LoopProduct-link, a.product-link, a');

                if (titleEl && linkEl) {
                    const title = titleEl.innerText.trim();
                    const link = linkEl.href;
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
                        items.push({ title, price, link, store: 'Lime Shoes', sizes: [] });
                    }
                }
            });
            return items;
        });
    }
}

module.exports = LimeShoesScraper;
module.exports = LimeShoesScraper;
