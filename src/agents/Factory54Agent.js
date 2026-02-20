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

                // === DIAGNOSTIC: Dump all data-* attributes on first .present-product ===
                const tileDiag = await this.page.evaluate(() => {
                    const tile = document.querySelector('.present-product');
                    if (!tile) return null;

                    const dataAttrs = {};
                    for (const attr of tile.attributes) {
                        if (attr.name.startsWith('data-')) {
                            dataAttrs[attr.name] = attr.value.substring(0, 200);
                        }
                    }

                    // Check all children for data attributes too
                    const childDataAttrs = [];
                    tile.querySelectorAll('[data-pid], [data-product-metadata], [data-sizes], [data-attr]').forEach(el => {
                        const info = { tag: el.tagName, className: el.className.substring(0, 80) };
                        for (const attr of el.attributes) {
                            if (attr.name.startsWith('data-')) {
                                info[attr.name] = attr.value.substring(0, 200);
                            }
                        }
                        childDataAttrs.push(info);
                    });

                    // Check for any hidden size elements
                    const hiddenSizeEls = [];
                    tile.querySelectorAll('[class*="size"], [class*="Size"]').forEach(el => {
                        hiddenSizeEls.push({
                            tag: el.tagName,
                            className: el.className.substring(0, 100),
                            text: el.innerText?.substring(0, 100) || '',
                            childCount: el.children.length,
                            display: window.getComputedStyle(el).display
                        });
                    });

                    return { dataAttrs, childDataAttrs, hiddenSizeEls };
                });

                if (tileDiag) {
                    console.log(`[Factory 54] DEBUG: Tile data-* attributes: ${JSON.stringify(tileDiag.dataAttrs)}`);
                    console.log(`[Factory 54] DEBUG: Children with data-attrs: ${JSON.stringify(tileDiag.childDataAttrs)}`);
                    console.log(`[Factory 54] DEBUG: Elements with 'size' class: ${JSON.stringify(tileDiag.hiddenSizeEls)}`);
                } else {
                    console.log(`[Factory 54] DEBUG: No .present-product tile found for diagnostics`);
                }

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

                        // Strategy 1: data-product-metadata JSON
                        const allDataEls = tile.querySelectorAll('[data-product-metadata], [data-sizes]');
                        allDataEls.forEach(el => {
                            const metaVal = el.getAttribute('data-product-metadata') || el.getAttribute('data-sizes') || '';
                            if (metaVal) {
                                try {
                                    const meta = JSON.parse(metaVal);
                                    const sizeArr = meta.sizes || meta.availableSizes || meta.size || [];
                                    if (Array.isArray(sizeArr)) {
                                        sizeArr.forEach(s => {
                                            const sv = s.toString();
                                            if (sv && !sizes.includes(sv)) sizes.push(sv);
                                        });
                                    }
                                } catch (e) { }
                            }
                        });

                        // Strategy 2: Size buttons/swatches (visible or hidden)
                        if (sizes.length === 0) {
                            tile.querySelectorAll(
                                '[class*="size"] button, [class*="size"] a, [class*="size"] span, ' +
                                '.popover button, .popover a, ' +
                                '[data-attr="size"] button, [data-attr="size"] .swatch-value'
                            ).forEach(el => {
                                const val = el.getAttribute('data-value') || el.innerText?.trim() || el.getAttribute('value') || '';
                                if (val && /^\d{2}(\.\d)?$/.test(val) && !sizes.includes(val)) sizes.push(val);
                            });
                        }

                        // Strategy 3: Check data-pid and look for variation JSON in scripts
                        if (sizes.length === 0) {
                            const pid = tile.querySelector('[data-pid]')?.getAttribute('data-pid') || '';
                            if (pid) {
                                document.querySelectorAll('script[type="application/json"]').forEach(script => {
                                    try {
                                        const data = JSON.parse(script.textContent);
                                        if (data && (data.id === pid || data.pid === pid) && data.variationAttributes) {
                                            const sizeAttr = data.variationAttributes.find(a =>
                                                (a.attributeId || '').toLowerCase().includes('size')
                                            );
                                            if (sizeAttr && sizeAttr.values) {
                                                sizeAttr.values.forEach(v => {
                                                    if (v.selectable !== false) {
                                                        const sv = v.displayValue || v.value || '';
                                                        if (sv && !sizes.includes(sv)) sizes.push(sv);
                                                    }
                                                });
                                            }
                                        }
                                    } catch (e) { }
                                });
                            }
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
                    console.log(`[Factory 54] DEBUG: ${p.raw_title} → Sizes: [${p.raw_sizes.join(', ')}]`);
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
