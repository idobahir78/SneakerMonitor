const InteractionScraper = require('./interaction-scraper');

class MegaSportScraper extends InteractionScraper {
    constructor(searchTerm) {
        // console.log(`[MegaSportScraper] Constructor received searchTerm: "${searchTerm}"`);
        const query = searchTerm;
        if (!query) throw new Error("Search term is required for MegaSportScraper");
        super('Mega Sport', `https://www.megasport.co.il/catalogsearch/result/?q=${encodeURIComponent(query)}`);
        this.searchTerm = query;
    }

    async navigate(page) {
        // 1. Go directly to the search results page (set in constructor)
        await page.goto(this.url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // 2. Handle Popups (Aggressive)
        await this.closePopup(page);

        // 3. Click Search
        const selectors = {
            searchToggle: '.block-search .action.search, .search-toggle-icon, [data-action="toggle-nav-search"]', // Shopify/Magento common
            searchInput: 'input[name="q"], input.search-header__input', // Updated based on HTML inspection
            searchIcon: 'details-modal summary' // Common Shopify
        };

        try {
            // console.log(`[Mega Sport] Interacting with search bar...`);

            // Ensure we are not stuck with a popup overlay
            await this.closePopup(page);

            // Check visibility
            let isInputVisible = await page.evaluate((sel) => {
                const el = document.querySelector(sel);
                return el && el.offsetParent !== null;
            }, selectors.searchInput);

            if (!isInputVisible) {
                console.log(`[Mega Sport] Search input hidden. Trying toggle/icon...`);
                // Try toggle or details-modal summary (common in Dawn theme which this looks like)
                const icon = await page.$(selectors.searchIcon);
                if (icon) {
                    await icon.click();
                    await new Promise(r => setTimeout(r, 1000));
                } else {
                    // Fallback to old toggle if icon not found
                    const toggle = await page.$(selectors.searchToggle);
                    if (toggle) {
                        await toggle.click();
                        await new Promise(r => setTimeout(r, 500));
                    }
                }
            }

            // Wait for input
            await page.waitForSelector(selectors.searchInput, { visible: true, timeout: 10000 });

            // Focus and Type
            await page.click(selectors.searchInput);

            // Clear input first to be safe
            await page.evaluate((sel) => { document.querySelector(sel).value = ''; }, selectors.searchInput);

            await this.typeSlowly(page, selectors.searchInput, this.searchTerm);
            await new Promise(r => setTimeout(r, 500)); // Wait before enter

            // Submit
            // console.log(`[Mega Sport] Submitting search for "${this.searchTerm}"...`);
            await page.keyboard.press('Enter');

            // 4. VERIFY Navigation to Search Page
            // console.log(`[Mega Sport] Waiting for navigation...`);
            try {
                await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 });
            } catch (e) {
                console.log(`[Mega Sport] Navigation timeout/ignored. Checking URL...`);
            }

            const currentUrl = page.url();
            // Check if URL indicates search results
            if (!currentUrl.includes('/search') && !currentUrl.includes('q=')) {
                console.warn(`[Mega Sport] Still on homepage (URL: ${currentUrl}). Retrying via direct URL...`);
                throw new Error("Search interaction failed to navigate");
            }

            // Wait for results OR "No results" message
            try {
                // We use a race to see WHAT we find first
                const foundSelector = await Promise.race([
                    page.waitForSelector('.product-card, .grid__item', { timeout: 30000 }).then(() => 'PRODUCTS'),
                    page.waitForSelector('.template-search__results', { timeout: 30000 }).then(() => 'RESULTS_CONTAINER'),
                    page.waitForFunction(() => document.body.innerText.includes('לא נמצאו') || document.body.innerText.includes('No results'), { timeout: 30000 }).then(() => 'NO_RESULTS_TEXT')
                ]);

                if (foundSelector === 'NO_RESULTS_TEXT') {
                    console.log(`[Mega Sport] Site explicitly reports "No Results".`);
                } else {
                    console.log(`[Mega Sport] Search results page loaded (Detected: ${foundSelector}).`);
                }
            } catch (e) {
                console.warn(`[Mega Sport] Timeout waiting for results or 'no results' text. Possible layout change or slow load.`);
                // Dump HTML snippet for debugging logic
                const snippet = await page.evaluate(() => document.body.innerText.substring(0, 500));
                console.log(`[Mega Sport HTML Dump]: ${snippet.replace(/\n/g, ' ')}...`);
            }

        } catch (e) {
            console.error(`[Mega Sport] Interaction failed: ${e.message}`);
            // Retry with direct URL if interaction fails
            const directUrl = `https://www.megasport.co.il/search?q=${encodeURIComponent(this.searchTerm)}`;
            console.log(`[Mega Sport] Retrying with direct URL: ${directUrl}`);
            await page.goto(directUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        }
    }

    async closePopup(page) {
        // IDs/Classes from debug HTML: #aca-modal, .aca-button-cross
        const popupSelectors = [
            '#aca-modal .aca-button-cross', // Specific to EasyGift
            '.aca-button-cross',
            '.ascl-close',
            'a[data-name="ascl-close"]',
            'button[aria-label="Close"]'
        ];

        // console.log(`[Mega Sport] Checking for popups...`);

        try {
            // Fast check for common popups
            const found = await page.evaluate(() => !!document.querySelector('#aca-modal') || !!document.querySelector('.ascl-close'));
            if (!found) {
                // Wait briefly just in case it's animating in
                try {
                    await page.waitForSelector('#aca-modal, .ascl-close', { visible: true, timeout: 3000 });
                } catch (e) { }
            }

            for (const selector of popupSelectors) {
                const elements = await page.$$(selector);
                for (const el of elements) {
                    if (await el.boundingBox()) { // Check visibility
                        // console.log(`[Mega Sport] Closing popup: ${selector}`);
                        await el.click();
                        await new Promise(r => setTimeout(r, 1000));
                        return;
                    }
                }
            }
        } catch (e) {
            console.log(`[Mega Sport] Popup check error: ${e.message}`);
        }
        // console.log(`[Mega Sport] Popup check complete.`);
    }

    async parse(page) {
        // Ensure we don't parse homepage featured items as search results unless we are actually on search page
        const url = page.url();
        if (!url.includes('/search') && !url.includes('q=')) {
            console.warn(`[Mega Sport] parse() called on non-search page: ${url}. Returning empty results.`);
            return [];
        }

        return await page.evaluate((searchTerm) => {
            const results = [];

            // Try multiple common selectors for products - prioritize search results
            const itemSelectors = ['.product-item', '.product-card', '.grid__item', '.list-view-item'];
            let items = [];

            for (const sel of itemSelectors) {
                const found = document.querySelectorAll(sel);
                if (found.length > 0) {
                    items = found;
                    break;
                }
            }

            items.forEach(item => {
                // Try multiple title/price/link selectors within the item
                const titleEl = item.querySelector('.product-item-link, .card__heading, .product-card__title, a.full-unstyled-link, h3, h4');
                const priceEl = item.querySelector('.price, .price-item--sale, .price-item--regular, .product-card__price');
                const linkEl = item.querySelector('a');
                const imgEl = item.querySelector('img.motion-reduce, img.grid-view-item__image, img');

                if (titleEl) {
                    const title = titleEl.innerText.trim();
                    const link = (titleEl.href || (linkEl ? linkEl.href : ''));
                    let price = 0;

                    if (priceEl) {
                        // Handle multiple prices (e.g. "800 ₪ 500 ₪") by finding all numbers and taking the min
                        const priceText = priceEl.innerText;
                        const numbers = priceText.match(/[0-9.]+/g);
                        if (numbers && numbers.length > 0) {
                            // Parse all numbers, filter out small styling artifacts if any, take min
                            price = Math.min(...numbers.map(n => parseFloat(n)));
                        }
                    }

                    // Strict filter: Title must basically match if it's very short, or just be valid
                    if (title && link) {
                        results.push({
                            title: title,
                            price: price,
                            link: link,
                            image: imgEl ? imgEl.src : '',
                            store: 'Mega Sport'
                        });
                    }
                }
            });
            return results;
        }, this.searchTerm);
    }

    // Keep existing parseSizes
    async parseSizes(page) {
        return await page.evaluate(() => {
            const sizes = [];

            // Mega Sport usually has swatch options or dropdown
            const swatches = document.querySelectorAll('.swatch-option.text:not(.disabled)');
            swatches.forEach(s => sizes.push(s.innerText.trim()));

            if (sizes.length === 0) {
                // Dropdown fallback
                const options = document.querySelectorAll('.super-attribute-select option');
                options.forEach(opt => {
                    if (opt.value && !opt.disabled && opt.innerText.match(/[0-9]/)) {
                        sizes.push(opt.innerText.trim());
                    }
                });
            }

            return sizes;
        });
    }
}

module.exports = MegaSportScraper;
