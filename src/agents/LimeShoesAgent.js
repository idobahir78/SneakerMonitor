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

        return new Promise(async (resolve, reject) => {
            try {
                const targetUrl = `${this.targetUrl}/?s=${query}&post_type=product`;

                await this.page.setDefaultNavigationTimeout(30000);
                console.log(`[Lime Shoes] Navigating to: ${targetUrl}`);
                await this.page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

                try {
                    await this.page.waitForSelector('.product, .product-item, li.product', { timeout: 10000 });
                } catch (e) { }

                // Scrape grid for product links + basic info
                const gridItems = await this.page.evaluate(() => {
                    const results = [];
                    const elements = document.querySelectorAll('li.product, .product-grid-item, div.product-item');

                    elements.forEach(el => {
                        const titleEl = el.querySelector('.woocommerce-loop-product__title, .product-title, h3, h2, .name');
                        const priceEls = el.querySelectorAll('.price bdi, .price .amount');
                        const linkEl = el.querySelector('a.woocommerce-LoopProduct-link, a.product-link, a[href*="/product/"], a');
                        const imgEl = el.querySelector('img.attachment-woocommerce_thumbnail, img');

                        if (!titleEl || !linkEl) return;

                        const raw_title = titleEl.innerText.trim();
                        const product_url = linkEl.href || linkEl.getAttribute('href') || '';
                        let raw_price = 0;

                        if (priceEls.length > 0) {
                            const priceText = priceEls[priceEls.length - 1].innerText;
                            const priceMatch = priceText.match(/(\d{2,4}\.?\d{0,2})/);
                            raw_price = priceMatch ? parseFloat(priceMatch[1]) : 0;
                        }

                        const isOutOfStock = el.classList.contains('outofstock') ||
                            (el.innerText && el.innerText.includes('אזל במלאי'));

                        if (raw_title && raw_price > 0 && !isOutOfStock && product_url) {
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

                // Fetch sizes from each PDP sequentially (sizes are in a <select> on the product page)
                const finalItems = [];
                for (const item of gridItems.slice(0, 10)) {
                    try {
                        await this.page.goto(item.raw_url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                        await new Promise(r => setTimeout(r, 1500));

                        const raw_sizes = await this.page.evaluate(() => {
                            const sizes = [];

                            // Strategy 1: WooCommerce <select> options (Lime Shoes uses this)
                            document.querySelectorAll('.variations select option:not([disabled]):not([value=""])').forEach(o => {
                                const v = (o.textContent || o.value || '').replace(/^(EU|US|UK)\s*/i, '').trim();
                                if (v && /\d/.test(v) && !sizes.includes(v)) sizes.push(v);
                            });

                            // Strategy 2: visual swatch/button items
                            if (sizes.length === 0) {
                                document.querySelectorAll(
                                    '.variable-items-wrapper .variable-item:not(.disabled):not(.out-of-stock) .variable-item-span, ' +
                                    '.wd-attribute-item:not(.disabled) .wd-attribute-label'
                                ).forEach(el => {
                                    const v = (el.innerText || '').replace(/^(EU|US|UK)\s*/i, '').trim();
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
