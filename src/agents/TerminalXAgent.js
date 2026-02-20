const DOMNavigator = require('./DOMNavigator');

class TerminalXAgent extends DOMNavigator {
    constructor() {
        super('TerminalX', 'https://www.terminalx.com');
    }

    async scrape(brand, model) {
        const query = encodeURIComponent(`${brand} ${model}`);
        const searchUrl = `${this.targetUrl}/catalogsearch/result/?q=${query}`;

        let interceptedItems = [];
        let apiDataCaptured = false;

        return new Promise(async (resolve, reject) => {
            try {
                // 1. Setup Network Interception
                this.page.on('response', async (response) => {
                    const url = response.url();

                    try {
                        const contentType = response.headers()['content-type'] || '';
                        if (contentType.includes('application/json')) {
                            // Debug log to see the API URLs we are intercepting
                            if (url.includes('graphql') || url.includes('api')) {
                                console.log(`[TerminalX Debug] JSON response from: ${url.substring(0, 150)}...`);
                            }

                            // Look for the GraphQL endpoint that Terminal X uses for searches
                            if (url.includes('/graphql') && response.request().method() === 'POST') {
                                const data = await response.json();

                                // TerminalX GraphQL response structure for searches
                                if (data?.data?.products?.items) {
                                    console.log(`[TerminalX] Intercepted GraphQL Response with ${data.data.products.items.length} items`);

                                    const items = data.data.products.items.map(p => this.formatApiResult(p));
                                    interceptedItems = interceptedItems.concat(items.filter(i => i !== null));
                                    apiDataCaptured = true;
                                }
                            }
                        }
                    } catch (err) {
                        // Suppress JSON parse errors for non-relevant requests
                    }
                });

                console.log(`[TerminalX] Navigating to search: ${searchUrl}`);

                // Use domcontentloaded instead of networkidle2 because we just need the XHR to fire, 
                // not wait for all images/analytics to stop loading.
                await this.page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

                // Give the GraphQL XHR up to 4 seconds to fire and complete after DOM loads
                await new Promise(r => setTimeout(r, 4000));

                if (apiDataCaptured) {
                    console.log(`[TerminalX] Successfully extracted ${interceptedItems.length} items via XHR Interception.`);
                    resolve(interceptedItems);
                    return;
                }

                // 2. Fallback: Extraction from window.__INITIAL_STATE__ (No DOM parsing)
                console.log(`[TerminalX] No matching GraphQL response intercepted. Falling back to window.__INITIAL_STATE__...`);

                const fallbackItems = await this.extractFromInitialState();

                if (fallbackItems.length === 0) {
                    console.log(`[TerminalX Debug] Fallback failed. Inspecting window object for state variables...`);
                    const title = await this.page.title();
                    console.log(`[TerminalX Title] ${title}`);
                    const windowKeys = await this.page.evaluate(() => {
                        return Object.keys(window).filter(k => k.toLowerCase().includes('state') || k.toLowerCase().includes('apollo') || k.toLowerCase().includes('data')).slice(0, 20);
                    });
                    console.log(`[TerminalX Global State Keys]`, windowKeys);
                }

                resolve(fallbackItems);

            } catch (error) {
                console.error(`[TerminalX] Scrape Error:`, error.message);
                resolve(interceptedItems); // Return whatever we managed to grab
            }
        });
    }

    /**
     * Map the raw JSON object from the TerminalX API into our standardized raw format
     */
    formatApiResult(p) {
        if (!p) return null;

        // Exhaustive title search
        let title = p.name || p.meta_title || p.product?.name || p.product?.meta_title ||
            p.product?.parent_product?.product?.name || p.parent_product?.product?.name ||
            p.variants?.[0]?.product?.parent_product?.product?.name || p.image?.label || 'Terminal X Sneaker';

        let brandName = p.brand || p.product?.brand || p.product?.parent_product?.product?.brand || 'Terminal X';

        // Exhaustive price search
        let priceVal = 0;
        const potentialPricePaths = [
            p.price_range?.minimum_price?.final_price?.value,
            p.price_final,
            p.final_price,
            p.price,
            p.product?.price_range?.minimum_price?.final_price?.value,
            p.product?.price_final,
            p.product?.final_price,
            p.product?.price,
            p.product?.parent_product?.product?.price_range?.minimum_price?.final_price?.value
        ];

        for (const val of potentialPricePaths) {
            if (val && !isNaN(Number(val?.value || val))) {
                priceVal = val?.value || val;
                break;
            }
        }

        priceVal = Number(priceVal);

        // Exhaustive Image extraction
        let imageUrl = p.image?.url || p.small_image?.url || p.image_url ||
            p.product?.image?.url || p.product?.small_image?.url || p.product?.image_url ||
            p.product?.parent_product?.product?.image?.url || '';

        // Exhaustive Product Link
        let link = p.url_key || p.url || p.product?.url_key || p.product?.url ||
            p.product?.parent_product?.product?.url_key || p.parent_product?.product?.url_key ||
            p.variants?.[0]?.product?.parent_product?.product?.url_key || p.variants?.[0]?.product?.url_key || '';

        // If no link exists in metadata, use the internal sku route
        if (!link && p.sku) {
            link = `default-category/${p.sku.toLowerCase()}`;
            if (p.defaultColorValueIndex) {
                link += `?color=${p.defaultColorValueIndex}`;
            }
        }

        if (link && !link.startsWith('http')) {
            link = `${this.targetUrl}/${link.replace(/^\//, '')}`;
            if (!link.endsWith('.html') && !link.includes('?')) {
                link += '.html';
            }
        }

        // Size extraction from variants/configurable_options
        let sizes = [];
        try {
            const sizeOption = (p.configurable_options || p.product?.configurable_options || [])
                .find(opt => (opt.attribute_code || opt.code || '').toLowerCase().includes('size'));
            if (sizeOption && sizeOption.values) {
                sizes = sizeOption.values
                    .filter(v => v.in_stock !== false && v.is_available !== false)
                    .map(v => v.label || v.value_index?.toString() || '')
                    .filter(s => s);
            }
            if (sizes.length === 0 && p.variants) {
                const variantArr = Array.isArray(p.variants) ? p.variants : Object.values(p.variants);
                for (const v of variantArr) {
                    const prod = v.product || v;
                    if (prod.stock_status === 'OUT_OF_STOCK' || prod.is_salable === false) continue;
                    const sizeAttr = (prod.attributes || []).find(a => (a.code || '').toLowerCase().includes('size'));
                    if (sizeAttr) sizes.push(sizeAttr.label || sizeAttr.value || '');
                }
                sizes = sizes.filter(s => s);
            }
        } catch (e) { }

        // Extremely generous filtering so we don't drop viable items
        if (!title || title === 'Terminal X Sneaker' || priceVal <= 0) {
            try { require('fs').writeFileSync('tx-rejected.json', JSON.stringify(p, null, 2)); } catch (e) { }
            return null;
        }

        return {
            raw_title: title.trim(),
            raw_price: priceVal,
            raw_image_url: imageUrl,
            raw_url: link,
            product_url: link,
            raw_brand: brandName,
            raw_sizes: sizes
        };
    }

    /**
     * Resilient Fallback: Extracts JSON state directly from the raw HTML payload
     * Bypasses React hydration deleting window.__INITIAL_STATE__ from memory.
     */
    async extractFromInitialState() {
        try {
            // Find the script tag containing the state in the loaded DOM
            const rawScriptText = await this.page.evaluate(() => {
                const scripts = Array.from(document.querySelectorAll('script'));
                const stateScript = scripts.find(s => s.textContent && s.textContent.includes('window.__INITIAL_STATE__ ='));
                return stateScript ? stateScript.textContent : null;
            });

            if (!rawScriptText) {
                console.error('[TerminalX Fallback] Could not find script containing __INITIAL_STATE__.');
                return [];
            }

            // Execute the script safely using Node's VM module to natively extract the object
            const vm = require('vm');
            const sandbox = { window: {} };
            vm.createContext(sandbox);

            try {
                // We only execute this exact script string which is just assignments.
                vm.runInContext(rawScriptText, sandbox);
            } catch (err) {
                console.error('[TerminalX Fallback] VM execution error:', err.message);
                // Return empty, but this usually works flawlessly for state assignments
                return [];
            }

            const state = sandbox.window.__INITIAL_STATE__;

            if (!state || typeof state !== 'object') {
                console.error('[TerminalX Fallback] VM successfully ran but state was invalid.');
                return [];
            }

            let foundItems = [];
            const findProducts = (obj, depth = 0) => {
                if (depth > 6 || !obj || typeof obj !== 'object') return;
                if (Array.isArray(obj) && obj.length > 0) {
                    if (obj[0].name || obj[0].meta_title || obj[0].sku || obj[0].price_range || obj[0].final_price) {
                        foundItems = foundItems.concat(obj);
                    }
                    return;
                }
                Object.keys(obj).forEach(key => {
                    if (key !== 'cms' && key !== 'menu' && key !== 'translations' && key !== 'config') {
                        findProducts(obj[key], depth + 1);
                    }
                });
            };

            // Check common paths in Terminal X state first
            if (state.catalog && state.catalog.products) {
                foundItems = Object.values(state.catalog.products);
            } else if (state.listingAndSearchStoreData?.data?.listing?.products?.items) {
                foundItems = state.listingAndSearchStoreData.data.listing.products.items;
            } else {
                findProducts(state);
            }

            console.log(`[TerminalX Fallback] Extracted ${foundItems.length} raw products from HTML state.`);

            const results = foundItems.map(p => this.formatApiResult(p)).filter(i => i !== null);
            return results;

        } catch (e) {
            console.error('[TerminalX Fallback] Failed to extract from state:', e.message);
            return [];
        }
    }
}

module.exports = TerminalXAgent;
