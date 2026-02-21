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

                // ========================================
                // DEMANDWARE SIZE EXTRACTION WITH RETRY
                // ========================================
                const extractWithRetry = async () => {
                    for (let attempt = 0; attempt < 3; attempt++) {
                        const products = await this.page.evaluate((attemptNum) => {
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

                                // ========================================
                                // DEEP ATTRIBUTE SCAN (Demandware-Specific)
                                // ========================================
                                const sizes = [];
                                let sizeSource = 'none';

                                // Strategy 1: data-size, data-attr-value, data-value attributes
                                tile.querySelectorAll('[data-size]').forEach(el => {
                                    const val = el.getAttribute('data-size');
                                    if (val && !sizes.includes(val)) { sizes.push(val); sizeSource = 'data-size'; }
                                });

                                if (sizes.length === 0) {
                                    tile.querySelectorAll('[data-attr-value], [data-value]').forEach(el => {
                                        const val = el.getAttribute('data-attr-value') || el.getAttribute('data-value') || '';
                                        if (val && /^\d{2}(\.\d)?$/.test(val) && !sizes.includes(val)) {
                                            sizes.push(val);
                                            sizeSource = 'data-attr-value';
                                        }
                                    });
                                }

                                // Strategy 2: Demandware swatch buttons with value attr
                                if (sizes.length === 0) {
                                    tile.querySelectorAll('.swatch-value, [data-attr="size"] button, [data-attr="size"] a, [data-attr="size"] span').forEach(el => {
                                        const val = el.getAttribute('data-attr-value') || el.getAttribute('data-value') || el.getAttribute('value') || '';
                                        if (val && !sizes.includes(val)) { sizes.push(val); sizeSource = 'swatch-value'; }
                                    });
                                }

                                // Strategy 3: Size buttons — extract from text, strip "US" prefix
                                if (sizes.length === 0) {
                                    tile.querySelectorAll('[class*="size"] button, [class*="size"] a, .size-btn, .size-button').forEach(el => {
                                        let val = el.getAttribute('data-size') || el.getAttribute('data-value') || '';
                                        if (!val) {
                                            const rawText = (el.innerText || el.textContent || '').trim();
                                            const cleaned = rawText.replace(/^(US|EU|UK)\s*/i, '');
                                            const numMatch = cleaned.match(/^(\d{2}(\.\d)?)$/);
                                            if (numMatch) val = numMatch[1];
                                        }
                                        if (val && !sizes.includes(val)) { sizes.push(val); sizeSource = 'size-button-text'; }
                                    });
                                }

                                // Strategy 4: JSON in data-product-metadata
                                if (sizes.length === 0) {
                                    tile.querySelectorAll('[data-product-metadata], [data-product]').forEach(el => {
                                        const raw = el.getAttribute('data-product-metadata') || el.getAttribute('data-product') || '';
                                        if (!raw) return;
                                        try {
                                            const meta = JSON.parse(raw);
                                            const arr = meta.sizes || meta.availableSizes || meta.attributes?.size || [];
                                            if (Array.isArray(arr)) {
                                                arr.forEach(s => {
                                                    const sv = typeof s === 'object' ? (s.value || s.label || '') : s.toString();
                                                    if (sv && !sizes.includes(sv)) { sizes.push(sv); sizeSource = 'product-metadata'; }
                                                });
                                            }
                                        } catch (e) { }
                                    });
                                }

                                // Strategy 5: variationAttributes in script tags matched by data-pid
                                if (sizes.length === 0) {
                                    const pid = tile.querySelector('[data-pid]')?.getAttribute('data-pid') || '';
                                    if (pid) {
                                        document.querySelectorAll('script[type="application/json"]').forEach(script => {
                                            try {
                                                const data = JSON.parse(script.textContent);
                                                if (data && (data.id === pid || data.pid === pid) && data.variationAttributes) {
                                                    const sizeAttr = data.variationAttributes.find(a =>
                                                        (a.attributeId || '').toLowerCase().match(/size|מידה/)
                                                    );
                                                    if (sizeAttr && sizeAttr.values) {
                                                        sizeAttr.values.forEach(v => {
                                                            if (v.selectable !== false) {
                                                                const sv = v.displayValue || v.value || '';
                                                                if (sv && !sizes.includes(sv)) { sizes.push(sv); sizeSource = 'variationAttributes'; }
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
                                    _sizeSource: sizeSource,
                                });
                            });

                            return results;
                        }, attempt);

                        // Check if we found sizes — if not, wait for AJAX hydration
                        const hasAnySizes = products.some(p => p.raw_sizes.length > 0);
                        if (hasAnySizes || attempt >= 2) {
                            return products;
                        }

                        // Check if buttons exist but returned empty text
                        const emptyButtons = await this.page.evaluate(() => {
                            return document.querySelectorAll('[class*="size"] button, .size-btn, .size-button, [data-size]').length;
                        });

                        if (emptyButtons > 0) {
                            console.log(`[Factory 54] Retry ${attempt + 1}: Found ${emptyButtons} size elements but no values. Waiting 2s for AJAX hydration...`);
                            await new Promise(r => setTimeout(r, 2000));
                        } else {
                            return products;
                        }
                    }
                    return [];
                };

                const products = await extractWithRetry();

                clearTimeout(timeout);
                console.log(`[Factory 54] Scraped ${products.length} products.`);
                products.forEach(p => {
                    console.log(`[Factory 54] DEBUG: "${p.raw_title}" → Sizes: [${p.raw_sizes.join(', ')}] (source: ${p._sizeSource})`);
                });
                resolve(products.map(p => {
                    delete p._sizeSource;
                    return p;
                }));

            } catch (err) {
                clearTimeout(timeout);
                console.error(`[Factory 54] Scrape error: ${err.message}`);
                resolve([]);
            }
        });
    }
}

module.exports = Factory54Agent;
