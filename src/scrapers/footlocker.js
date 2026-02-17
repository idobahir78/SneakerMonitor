const BaseScraper = require('./base-scraper');

class FootLockerScraper extends BaseScraper {
    constructor(searchTerm) {
        const query = searchTerm;
        if (!query) throw new Error("Search term is required for FootLockerScraper");
        super('Foot Locker IL', `https://www.footlocker.co.il/search?q=${encodeURIComponent(query)}`);
    }

    async parse(page) {
        const results = [];

        // Method 1: Extract from data-events script (most reliable for search)
        try {
            const html = await page.content();
            // Look for the specific script tag with data-events
            const eventMatch = html.match(/data-events="(\[\[.*?\]\])"/);

            if (eventMatch && eventMatch[1]) {
                const rawJson = eventMatch[1].replace(/&quot;/g, '"');
                const events = JSON.parse(rawJson);

                // Find search_submitted event or similar which contains product data
                const searchEvent = events.find(e => e[0] === 'search_submitted' || e[0] === 'view_item_list');

                if (searchEvent && searchEvent[1]) {
                    let products = [];
                    if (searchEvent[1].searchResult && searchEvent[1].searchResult.productVariants) {
                        products = searchEvent[1].searchResult.productVariants.map(p => ({
                            title: p.product.title,
                            price: p.price.amount,
                            link: p.product.url,
                            vendor: p.product.vendor,
                            image: p.image?.src
                        }));
                    } else if (searchEvent[1].items) {
                        products = searchEvent[1].items;
                    }

                    if (products.length > 0) {
                        console.info(`Extracted ${products.length} products from JSON events.`);
                        products.forEach(p => {
                            if (results.length >= 15) return;

                            let link = p.link || p.url;
                            if (link && link.startsWith('/')) link = `https://www.footlocker.co.il${link}`;

                            results.push({
                                title: p.title || p.item_name,
                                price: Number(p.price),
                                priceText: `₪${p.price}`,
                                link: link,
                                brand: p.vendor || p.item_brand || 'Foot Locker',
                                image: p.image ? (p.image.startsWith('//') ? `https:${p.image}` : p.image) : null
                            });
                        });
                    }
                }
            }
        } catch (e) {
            console.error('Error parsing Foot Locker JSON events:', e);
        }

        // Method 2: Fallback to DOM selectors if JSON failed or no products found
        if (results.length === 0) {
            console.info('JSON extraction failed or found no products, falling back to DOM parsing.');

            const domResults = await page.evaluate(() => {
                const pageResults = [];
                // Specific Foot Locker Search Result Selectors
                // They often use a grid structure with specific classes
                const items = document.querySelectorAll('.product-card, .product-item, .card-wrapper, .c-product-card');

                items.forEach(item => {
                    if (pageResults.length >= 15) return;

                    const titleEl = item.querySelector('.product-card__title, .c-product-card__title, h3');
                    const priceEl = item.querySelector('.price-item--regular, .product-card__price, .c-price__regular');
                    const linkEl = item.querySelector('a');
                    const imgEl = item.querySelector('img');

                    if (titleEl && linkEl) {
                        const title = titleEl.innerText.trim();
                        let link = linkEl.href;

                        let price = 0;
                        if (priceEl) {
                            const priceText = priceEl.innerText.trim();
                            const numbers = priceText.replace(/[^\d.]/g, '').match(/[0-9.]+/g);
                            if (numbers && numbers.length > 0) price = parseFloat(numbers[0]);
                        }

                        if (title) {
                            pageResults.push({
                                title,
                                price,
                                priceText: `₪${price}`,
                                link,
                                image: imgEl ? imgEl.src : null,
                                brand: 'Foot Locker'
                            });
                        }
                    }
                });
                return pageResults;
            });

            results.push(...domResults);
        }

        return results;
    }

    async parseSizes(page) {
        return await page.evaluate(() => {
            const sizes = [];
            // Common Foot Locker selectors: .c-form-field--radio-pill or .ProductSize-group
            const sizeEls = document.querySelectorAll('.c-form-field--radio-pill label, .ProductSize-group .c-form-field__label');

            sizeEls.forEach(el => {
                const inputId = el.getAttribute('for');
                if (inputId) {
                    const input = document.getElementById(inputId);
                    if (input && !input.disabled) {
                        sizes.push(el.innerText.trim());
                    }
                } else {
                    sizes.push(el.innerText.trim());
                }
            });
            return sizes;
        });
    }
}

module.exports = FootLockerScraper;
