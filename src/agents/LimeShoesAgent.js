const DOMNavigator = require('./DOMNavigator');

// LimeShoes specializes in running/performance brands only.
// Browser research confirmed they carry: Asics, Hoka, New Balance, Saucony, Brooks, Birkenstock
// They do NOT stock Nike, Adidas, Reebok, Puma, Jordan, etc.
const LIMESHOES_BRANDS = ['asics', 'hoka', 'new balance', 'saucony', 'brooks', 'birkenstock', 'on', 'mizuno'];

class LimeShoesAgent extends DOMNavigator {
    constructor() {
        super('Lime Shoes', 'https://limeshoes.co.il');
    }

    async scrape(brand, model) {
        // Skip immediately if LimeShoes doesn't carry this brand
        if (!LIMESHOES_BRANDS.includes(brand.toLowerCase())) {
            console.log(`[Lime Shoes] Skipping – brand "${brand}" not in LimeShoes inventory.`);
            return [];
        }
        const query = encodeURIComponent(model);

        return new Promise(async (resolve) => {
            try {
                const targetUrl = `${this.targetUrl}/?s=${query}&post_type=product`;

                await this.page.setDefaultNavigationTimeout(30000);
                console.log(`[Lime Shoes] Navigating to: ${targetUrl}`);
                await this.page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

                // DOM research confirmed: WooCommerce uses ul.products as the grid container.
                // Individual product tiles are <li> children of ul.products.
                // The li class includes 'type-product' but NOT 'product' by itself.
                try {
                    await this.page.waitForSelector('ul.products li', { timeout: 10000 });
                } catch (e) { /* page might load without selector - continue anyway */ }

                // Scrape grid: confirmed selectors from live HTML inspection
                const gridItems = await this.page.evaluate(() => {
                    const results = [];

                    // ul.products is the confirmed WooCommerce grid container on limeshoes.co.il
                    const elements = document.querySelectorAll('ul.products li');
                    console.log('[Lime Shoes] ul.products li count:', elements.length);

                    elements.forEach(el => {
                        // Confirmed class from live HTML: woocommerce-loop-product__title
                        const titleEl = el.querySelector('.woocommerce-loop-product__title, h2, h3');
                        // Confirmed class from live HTML: woocommerce-LoopProduct-link
                        const linkEl = el.querySelector('a.woocommerce-LoopProduct-link, a[href*="/product/"]');
                        const imgEl = el.querySelector('img');
                        const priceEl = el.querySelector('.price .woocommerce-Price-amount, .price bdi, .price .amount');

                        if (!titleEl || !linkEl) return;

                        const raw_title = titleEl.innerText.trim();
                        const product_url = linkEl.href || '';
                        let raw_price = 0;

                        if (priceEl) {
                            // Handle Israeli thousands separator comma: ₪1,099 or ₪999
                            const priceText = (priceEl.innerText || '').replace(/,/g, '');
                            const m = priceText.match(/(\d{2,5})/);
                            raw_price = m ? parseFloat(m[1]) : 0;
                        }

                        const isOutOfStock = el.classList.contains('outofstock') ||
                            el.innerText.includes('אזל במלאי');

                        if (raw_title && product_url && !isOutOfStock) {
                            results.push({
                                raw_title,
                                raw_price,
                                raw_url: product_url,
                                raw_image_url: imgEl?.src || '',
                                raw_brand: 'Unknown'
                            });
                        }
                    });
                    return results;
                });

                console.log(`[Lime Shoes] Scraped ${gridItems.length} raw items from DOM. Fetching sizes from PDPs...`);

                // Fetch sizes from each PDP sequentially
                // Confirmed from live HTML: sizes are in <select id="pa_shoe-sizes"> options
                const finalItems = [];
                for (const item of gridItems.slice(0, 10)) {
                    try {
                        await this.page.goto(item.raw_url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                        await new Promise(r => setTimeout(r, 1500));

                        const raw_sizes = await this.page.evaluate(() => {
                            const sizes = [];

                            // CONFIRMED: Lime Shoes PDP uses <select id="pa_shoe-sizes">
                            // with options containing EU sizes like "40.5", "41", "42", "44" etc.
                            const shoeSizeSelect = document.querySelector('select#pa_shoe-sizes, select[name="attribute_pa_shoe-sizes"]');
                            if (shoeSizeSelect) {
                                [...shoeSizeSelect.options].forEach(opt => {
                                    if (!opt.value || opt.disabled) return;
                                    const v = opt.textContent.replace(/^(EU|US|UK)\s*/i, '').trim();
                                    if (v && /\d/.test(v) && !sizes.includes(v)) sizes.push(v);
                                });
                            }

                            // Fallback: any .variations select options with numeric sizes
                            if (sizes.length === 0) {
                                document.querySelectorAll('.variations select option:not([disabled]):not([value=""])').forEach(opt => {
                                    const v = opt.textContent.replace(/^(EU|US|UK)\s*/i, '').trim();
                                    if (v && /\d/.test(v) && !sizes.includes(v)) sizes.push(v);
                                });
                            }

                            return sizes;
                        });

                        console.log(`[Lime Shoes] "${item.raw_title}" → Sizes: [${raw_sizes.join(', ')}]`);
                        finalItems.push({ ...item, raw_sizes });
                    } catch (e) {
                        console.log(`[Lime Shoes] Failed to fetch PDP sizes for: ${item.raw_url}`);
                        finalItems.push({ ...item, raw_sizes: [] });
                    }
                }

                resolve(finalItems);
            } catch (error) {
                console.error(`[Lime Shoes] Scrape Error:`, error.message);
                resolve([]);
            }
        });
    }
}

module.exports = LimeShoesAgent;
