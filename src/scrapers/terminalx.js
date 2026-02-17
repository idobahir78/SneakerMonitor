const Scraper = require('./base-scraper');

class TerminalXScraper extends Scraper {
    constructor(query) {
        super('Terminal X', `https://www.terminalx.com/catalogsearch/result/?q=${encodeURIComponent(query)}`);
    }

    async parse(page) {
        let items = [];

        // Wait for results - try not to fail immediately if selector is missing
        try {
            await page.waitForSelector('.listing-product_3mjp, .product-item-info', { timeout: 10000 });
        } catch (e) {
            console.log('Terminal X: Standard selector not found (timeout), checking for other layouts or fallback...');
        }

        // 1. Try DOM selectors first and most reliable method for rendered pages
        items = await page.evaluate(() => {
            const results = [];
            // Selectors based on inspection
            const itemEls = document.querySelectorAll('.listing-product_3mjp, .product-item-info, li.product-item');

            itemEls.forEach(el => {
                const titleEl = el.querySelector('.right_1o65, .product-item-link, a.title, .name');
                const brandEl = el.querySelector('.color_3hmL, .product-item-brand');
                const priceEl = el.querySelector('.price_2Www, .price, .final-price, [data-price-amount]');
                const linkEl = el.querySelector('a');
                const imgEl = el.querySelector('img');

                if (titleEl && priceEl) {
                    const priceText = priceEl.innerText;
                    const price = parseFloat(priceText.replace(/[^\d.]/g, ''));

                    if (price > 0) {
                        const title = titleEl.innerText.trim();
                        let link = linkEl ? linkEl.href : '';

                        // normalize link
                        if (link && !link.startsWith('http')) {
                            link = window.location.origin + (link.startsWith('/') ? link : '/' + link);
                        }

                        results.push({
                            title: title,
                            price: price,
                            priceText: `₪${price}`,
                            link: link,
                            image: imgEl ? imgEl.src : null,
                            brand: brandEl ? brandEl.innerText.trim() : 'Terminal X'
                        });
                    }
                }
            });
            return results;
        });

        if (items.length > 0) return items;

        // 2. Fallback: Parse window.__INITIAL_STATE__ via page.evaluate (safer) or regex
        if (items.length === 0) {
            console.log('Standard selectors failed, attempting to extract window.__INITIAL_STATE__...');
            try {
                // Try to get state directly from window object
                let state = await page.evaluate(() => {
                    return window.__INITIAL_STATE__ || null;
                });

                // If not found on window, try regex on HTML content
                if (!state) {
                    console.log('window.__INITIAL_STATE__ not found on window object, trying regex...');
                    const html = await page.content();
                    // Greedy match for the object, assuming it ends with }; 
                    // Use a safer pattern that looks for the variable assignment
                    const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});/);
                    if (stateMatch && stateMatch[1]) {
                        // Use Function constructor (safer eval) to parse potential loose JSON
                        // Wrap in parens to ensure it's treated as expression
                        const safeEval = new Function('return ' + stateMatch[1]);
                        state = safeEval();
                    }
                }

                if (state) {
                    let productData = [];

                    console.log('Terminal X State Keys:', Object.keys(state));
                    if (state.catalog) console.log('Terminal X Catalog Keys:', Object.keys(state.catalog));

                    // Helper to find array of products recursively
                    const findProducts = (obj, depth = 0) => {
                        if (depth > 5) return;
                        if (!obj || typeof obj !== 'object') return;
                        if (Array.isArray(obj)) {
                            // Heuristic: Array of objects with 'name' and 'price' or 'meta_title'
                            if (obj.length > 0 && (obj[0].name || obj[0].meta_title) && (obj[0].price || obj[0].final_price || obj[0].small_image)) {
                                console.log(`Found product array at depth ${depth} with ${obj.length} items. Sample key: ${Object.keys(obj[0]).join(',')}`);
                                productData = productData.concat(obj);
                            }
                            return;
                        }
                        Object.keys(obj).forEach(key => {
                            // Optimization: skip large non-product keys if known
                            if (key !== 'cms' && key !== 'menu') findProducts(obj[key], depth + 1);
                        });
                    };

                    if (state.catalog && state.catalog.products) {
                        productData = Object.values(state.catalog.products);
                    } else if (state.listingAndSearchStoreData && state.listingAndSearchStoreData.data && state.listingAndSearchStoreData.data.listing && state.listingAndSearchStoreData.data.listing.products) {
                        productData = state.listingAndSearchStoreData.data.listing.products.items || [];
                    } else {
                        findProducts(state);
                    }

                    console.log(`Found ${productData.length} items in JSON state.`);

                    productData.forEach(p => {
                        if (items.length >= 15) return;

                        let title = p.name || p.meta_title;
                        if (!title && p.brand) title = `${p.brand} ${p.short_description || ''}`;

                        // Price logic
                        let priceVal = 0;
                        if (p.price_final) priceVal = p.price_final;
                        else if (p.final_price) priceVal = p.final_price;
                        else if (p.price) priceVal = p.price;

                        if (typeof priceVal === 'object' && priceVal.value) priceVal = priceVal.value;

                        priceVal = Number(priceVal);

                        let imageUrl = p.image_url || p.small_image || (p.media_gallery?.[0]?.image_url);

                        // Link
                        let link = p.url || p.url_key;
                        if (link && !link.startsWith('http')) {
                            link = `https://www.terminalx.com/${link}`;
                            if (!link.endsWith('.html')) link += '.html';
                        }

                        if (title && priceVal > 0) {
                            items.push({
                                title: title.trim(),
                                price: priceVal,
                                priceText: `₪${priceVal}`,
                                link: link,
                                image: imageUrl,
                                brand: p.brand || 'Terminal X'
                            });
                        }
                    });
                }
            } catch (e) {
                console.error('Error parsing Terminal X JSON state:', e.message);
            }
        }

        return items;
    }
}

module.exports = TerminalXScraper;
