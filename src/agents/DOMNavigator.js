const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

// Target a specific Chrome signature to match Puppeteer's internal Chromium TLS fingerprint.
// Using Safari or Firefox UAs with a Chrome network stack guarantees an instant Cloudflare ban.
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
];

class DOMNavigator {
    constructor(storeName, targetUrl) {
        this.storeName = storeName;
        this.targetUrl = targetUrl;
        this.browser = null;
        this.page = null;
    }

    getRandomUserAgent() {
        const randomIndex = Math.floor(Math.random() * USER_AGENTS.length);
        return USER_AGENTS[randomIndex];
    }

    async init() {
        try {
            this.browser = await puppeteer.launch({
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--window-size=1920x1080',
                    '--ignore-certificate-errors'
                ]
            });
            this.page = await this.browser.newPage();

            // Set 60-second navigation timeout for slow sites like Factory54
            this.page.setDefaultNavigationTimeout(60000);
            this.page.setDefaultTimeout(60000);

            // Set random User-Agent to prevent 403 Forbidden
            const userAgent = this.getRandomUserAgent();
            await this.page.setUserAgent(userAgent);
            await this.page.setExtraHTTPHeaders({
                'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
                'Referer': 'https://www.google.com/'
                // Let Chrome handle Sec-Fetch-* headers natively to avoid mismatches
            });

            // Set viewport
            await this.page.setViewport({ width: 1920, height: 1080 });

            console.log(`[${this.storeName}] Initialized Navigator with agent: ${userAgent.substring(0, 30)}...`);
        } catch (error) {
            console.error(`[${this.storeName}] Error initializing browser:`, error.message);
            throw error;
        }
    }

    /**
     * Navigate to a URL with 1 automatic retry on failure.
     * @param {string} url
     * @param {Object} options  puppeteer goto options
     */
    async navigateWithRetry(url, options = { waitUntil: 'domcontentloaded' }, maxRetries = 2) {
        let attempt = 0;
        while (attempt <= maxRetries) {
            try {
                // Randomize fingerprint on every request
                const width = 1440 + Math.floor(Math.random() * 500);
                const height = 900 + Math.floor(Math.random() * 300);
                await this.page.setViewport({ width, height });
                await this.page.setUserAgent(this.getRandomUserAgent());

                const response = await this.page.goto(url, options);
                // Human behavior: add a random delay (1000ms - 3000ms) after the page loads
                const delay = 1000 + Math.floor(Math.random() * 2000);
                await new Promise(r => setTimeout(r, delay));
                return response;
            } catch (err) {
                attempt++;
                console.warn(`[${this.storeName}] Navigation failed (${err.message}). Retry ${attempt}/${maxRetries}...`);
                if (attempt > maxRetries) throw err;

                // Shift viewport on retry to bypass bot checks based on static screen sizes
                const width = 1440 + Math.floor(Math.random() * 500);
                const height = 900 + Math.floor(Math.random() * 300);
                await this.page.setViewport({ width, height });

                await new Promise(r => setTimeout(r, 5000)); // 5s pause on block
            }
        }
    }

    /**
     * Override this method in child store classes.
     * It should return an array of raw item objects.
     */
    async scrape(brand, model) {
        throw new Error('scrape() must be implemented by subclass');
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            console.log(`[${this.storeName}] Browser closed.`);
        }
    }
}

module.exports = DOMNavigator;
