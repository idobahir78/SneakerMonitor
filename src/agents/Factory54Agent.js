const DOMNavigator = require('./DOMNavigator');

const PUPPETEER_LAUNCH_ARGS = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--window-size=1920x1080'
];

class Factory54Agent extends DOMNavigator {
    constructor() {
        super('Factory 54', 'https://www.factory54.co.il');
    }

    async init() {
        const puppeteer = require('puppeteer-extra');
        const StealthPlugin = require('puppeteer-extra-plugin-stealth');
        puppeteer.use(StealthPlugin());

        this.browser = await puppeteer.launch({
            headless: 'new',
            args: PUPPETEER_LAUNCH_ARGS
        });
        this.page = await this.browser.newPage();

        this.page.setDefaultNavigationTimeout(60000);
        this.page.setDefaultTimeout(60000);

        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        await this.page.setViewport({ width: 1920, height: 1080 });
        await this.page.setExtraHTTPHeaders({
            'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
            'Referer': 'https://www.factory54.co.il/men',
            'X-Requested-With': 'XMLHttpRequest'
        });
        console.log(`[Factory 54] Isolated init completed`);
    }

    async scrape(brand, model) {
        const query = encodeURIComponent(`${brand} ${model}`);
        const searchUrl = `${this.targetUrl}/on/demandware.store/Sites-factory54-Site/iw_IL/Search-Show?q=${query}&lang=iw_IL&start=0&sz=36&format=ajax`;

        return new Promise(async (resolve, reject) => {
            const timeout = setTimeout(() => {
                console.warn(`[Factory 54] Scrape timed out.`);
                resolve([]);
            }, 60000);

            try {
                await this.page.setRequestInterception(true);

                this.page.on('request', req => {
                    const url = req.url();
                    if (url.includes('.png') || url.includes('.jpg') || url.includes('.gif') || url.includes('.woff')) {
                        req.abort();
                    } else {
                        req.continue();
                    }
                });

                await this.navigateWithRetry(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

                await new Promise(r => setTimeout(r, 5000));

                const products = await this.page.evaluate(() => {
                    function norm(u) {
                        if (!u) return '';
                        u = u.trim();
                        if (u.startsWith('http')) return u;
                        if (u.startsWith('//')) return 'https:' + u;
                        if (u.startsWith('/')) return 'https://www.factory54.co.il' + u;
                        return 'https://www.factory54.co.il/' + u;
                    }

                    const results = [];
                    const tiles = document.querySelectorAll('.present-product');

                    tiles.forEach(tile => {
                        const nameEl = tile.querySelector('a.tile-body__product-name');
                        if (!nameEl) return;

                        const brandEl = tile.querySelector('span.tile-body__product-name-brand');
                        const brandText = brandEl?.innerText?.trim() || '';
                        const fullText = nameEl.innerText?.trim() || '';
                        const titleText = fullText.replace(brandText, '').trim();
                        const title = brandText ? `${brandText} ${titleText}` : fullText;

                        if (!title || title.length < 3) return;

                        const linkHref = nameEl.getAttribute('href') || '';

                        const priceEl = tile.querySelector('.tile-body__price, [class*="price"]');
                        const priceText = priceEl?.innerText?.trim() || '0';
                        const priceMatch = priceText.replace(/,/g, '').match(/[\d.]+/);
                        const price = priceMatch ? parseFloat(priceMatch[0]) : 0;

                        const imgEl = tile.querySelector('img');
                        const imgSrc = imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || '';

                        const tileBody = tile.querySelector('.tile-body, .present-product__tile-body');
                        const fullContext = tileBody?.innerText?.trim() || '';

                        // === SIZE EXTRACTION ===
                        const sizes = [];

                        // Strategy 1: Check data-product-metadata or data-pid for JSON
                        const pid = tile.getAttribute('data-pid') || tile.querySelector('[data-pid]')?.getAttribute('data-pid') || '';
                        const metadataAttr = tile.getAttribute('data-product-metadata') || tile.querySelector('[data-product-metadata]')?.getAttribute('data-product-metadata') || '';
                        if (metadataAttr) {
                            try {
                                const meta = JSON.parse(metadataAttr);
                                if (meta.sizes && Array.isArray(meta.sizes)) {
                                    meta.sizes.forEach(s => { if (s) sizes.push(s.toString()); });
                                }
                            } catch (e) { }
                        }

                        // Strategy 2: Look for size swatches/buttons in popover
                        if (sizes.length === 0) {
                            const sizeEls = tile.querySelectorAll(
                                '.popover .size-btn, .popover .size-option, ' +
                                '[class*="size-list"] button, [class*="size-list"] a, ' +
                                '.product-tile__size button, .swatches [data-attr="size"] button, ' +
                                '[class*="size"] .selectable, [data-attr*="size"] .swatch-value'
                            );
                            sizeEls.forEach(el => {
                                const val = el.innerText?.trim() || el.getAttribute('data-value') || el.getAttribute('value') || '';
                                if (val && /^\d{2}(\.\d)?$/.test(val) && !sizes.includes(val)) sizes.push(val);
                            });
                        }

                        // Strategy 3: Look for JSON in script tags with product ID
                        if (sizes.length === 0 && pid) {
                            const scripts = document.querySelectorAll('script[type="application/json"]');
                            scripts.forEach(script => {
                                try {
                                    const data = JSON.parse(script.textContent);
                                    if (data && data.id === pid && data.variationAttributes) {
                                        const sizeAttr = data.variationAttributes.find(a =>
                                            (a.attributeId || '').toLowerCase().includes('size')
                                        );
                                        if (sizeAttr && sizeAttr.values) {
                                            sizeAttr.values.forEach(v => {
                                                if (v.selectable !== false) {
                                                    const val = v.displayValue || v.value || '';
                                                    if (val && !sizes.includes(val)) sizes.push(val);
                                                }
                                            });
                                        }
                                    }
                                } catch (e) { }
                            });
                        }

                        results.push({
                            raw_title: title,
                            raw_price: price,
                            raw_url: norm(linkHref),
                            raw_image_url: norm(imgSrc),
                            raw_sizes: sizes,
                            full_context: fullContext,
                        });
                    });

                    return results;
                });

                clearTimeout(timeout);
                console.log(`[Factory 54] Scraped ${products.length} products.`);
                products.forEach(p => {
                    if (p.raw_sizes.length > 0) {
                        console.log(`[Factory 54] DEBUG: Found ${p.raw_sizes.length} sizes for ${p.raw_title}: [${p.raw_sizes.join(', ')}]`);
                    }
                });
                resolve(products);

            } catch (err) {
                clearTimeout(timeout);
                console.error(`[Factory 54] Scrape error: ${err.message}`);
                resolve([]);
            }
        });
    }
}

module.exports = Factory54Agent;
