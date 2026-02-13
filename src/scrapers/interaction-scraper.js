const BaseScraper = require('./base-scraper');

/**
 * InteractionScraper: A more advanced scraper that behaves like a user.
 * Instead of visiting a direct URL, it goes to a homepage and interacts.
 */
class InteractionScraper extends BaseScraper {
    constructor(storeName, homeUrl) {
        super(storeName, homeUrl);
    }

    /**
     * Override scrape to handle the interaction flow if needed, 
     * or provide helper methods for subclasses to use in their parse/scrape logic.
     * 
     * Here we provide helpers that subclasses can call inside their `parse` 
     * or a new `navigateAndUnknown` method.
     */

    async typeSlowly(page, selector, text) {
        try {
            await page.waitForSelector(selector, { visible: true, timeout: 10000 });
            await page.click(selector);

            // Randomize typing speed to look human
            for (const char of text) {
                await page.keyboard.type(char, { delay: Math.random() * 100 + 50 });
            }
        } catch (e) {
            console.error(`[${this.storeName}] Error typing in ${selector}:`, e.message);
            throw e;
        }
    }

    async submitSearch(page, submitSelector = null) {
        try {
            if (submitSelector) {
                await page.waitForSelector(submitSelector, { visible: true, timeout: 5000 });
                await Promise.all([
                    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(e => console.log("Nav timeout ignored")),
                    page.click(submitSelector)
                ]);
            } else {
                // Press Enter
                await Promise.all([
                    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(e => console.log("Nav timeout ignored")),
                    page.keyboard.press('Enter')
                ]);
            }
        } catch (e) {
            console.error(`[${this.storeName}] Error submitting search:`, e.message);
        }
    }
}

module.exports = InteractionScraper;
