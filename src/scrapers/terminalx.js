const BaseScraper = require('./base-scraper');

class TerminalXScraper extends BaseScraper {
    constructor(searchTerm) {
        const query = searchTerm;
        if (!query) throw new Error("Search term is required for TerminalXScraper");
        super('Terminal X', `https://www.terminalx.com/catalogsearch/result/?q=${encodeURIComponent(query)}`);
    }

    async parse(page) {
        return await page.evaluate(() => {
            const results = [];

            try {
                const state = window.__INITIAL_STATE__;
                let items = [];

                // Path: state.listingAndSearchStoreData.data.listing.products.items
                if (state &&
                    state.listingAndSearchStoreData &&
                    state.listingAndSearchStoreData.data &&
                    state.listingAndSearchStoreData.data.listing &&
                    state.listingAndSearchStoreData.data.listing.products &&
                    state.listingAndSearchStoreData.data.listing.products.items) {
                    items = state.listingAndSearchStoreData.data.listing.products.items;
                } else if (state && state.products && state.products.items) {
                    items = state.products.items;
                }

                if (items && Array.isArray(items) && items.length > 0) {
                    items.forEach(item => {
                        const title = item.name || item.meta_title || 'Unknown Product';

                        let price = 0;
                        if (item.final_price && item.final_price.value) {
                            price = item.final_price.value;
                        } else if (item.price_range && item.price_range.maximum_price) {
                            price = item.price_range.maximum_price.final_price.value;
                        } else if (item.price) {
                            price = item.price;
                        }

                        let link = item.url_key ? `https://www.terminalx.com/${item.url_key}` : '';
                        if (!link && item.url) link = item.url;

                        if (title && link) {
                            results.push({
                                store: 'Terminal X',
                                title: title,
                                price: parseFloat(price),
                                link: link,
                                sizes: []
                            });
                        }
                    });
                    if (results.length > 0) return results;
                }
            } catch (e) {
                console.error('Terminal X JSON extraction failed:', e);
            }

            // Fallback: DOM Selectors
            const domItems = document.querySelectorAll('.product-item-info, li.product-item');
            domItems.forEach(item => {
                const titleEl = item.querySelector('.product-item-link, a.title');
                const priceEl = item.querySelector('.price, .final-price');

                if (titleEl) {
                    const title = titleEl.innerText.trim();
                    const link = titleEl.href;
                    let priceText = '0';
                    if (priceEl) priceText = priceEl.innerText.trim();
                    const numbers = priceText.match(/[0-9.]+/g);
                    let price = 0;
                    if (numbers && numbers.length > 0) {
                        price = Math.min(...numbers.map(n => parseFloat(n)));
                    }
                    results.push({ store: 'Terminal X', title, price, link, sizes: [] });
                }
            });
            return results;
        });
    }

    async parseSizes(page) {
        return await page.evaluate(() => {
            const sizes = [];
            const sizeEls = document.querySelectorAll('.swatch-option.text');
            sizeEls.forEach(el => {
                if (!el.classList.contains('disabled') && !el.classList.contains('missing')) {
                    sizes.push(el.innerText.trim());
                }
            });
            return sizes;
        });
    }
}

module.exports = TerminalXScraper;
