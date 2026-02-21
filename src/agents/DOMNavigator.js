const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36'
];

class DOMNavigator {
    constructor(storeName, targetUrl) {
        this.storeName = storeName;
        this.targetUrl = targetUrl;
        this.browser = null;
        this.page = null;
    }

    getRandomUserAgent() {
        return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
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
            this.page.setDefaultNavigationTimeout(60000);
            this.page.setDefaultTimeout(60000);

            const userAgent = this.getRandomUserAgent();
            await this.page.setUserAgent(userAgent);
            await this.page.setExtraHTTPHeaders({
                'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
                'Referer': 'https://www.google.com/'
            });
            await this.page.setViewport({ width: 1920, height: 1080 });
            console.log(`[${this.storeName}] Initialized Navigator with stealth headers.`);
        } catch (error) {
            console.error(`[${this.storeName}] Error initializing browser:`, error.message);
            throw error;
        }
    }

    async navigateWithRetry(url, options = { waitUntil: 'domcontentloaded' }, maxRetries = 2) {
        let attempt = 0;
        while (attempt <= maxRetries) {
            try {
                const width = 1440 + Math.floor(Math.random() * 500);
                const height = 900 + Math.floor(Math.random() * 300);
                await this.page.setViewport({ width, height });
                await this.page.setUserAgent(this.getRandomUserAgent());

                const response = await this.page.goto(url, options);

                if (response && (response.status() === 403 || response.status() === 404)) {
                    throw new Error(`HTTP ${response.status()}`);
                }

                await new Promise(r => setTimeout(r, 1000 + Math.floor(Math.random() * 2000)));
                return response;
            } catch (err) {
                attempt++;
                if (attempt > maxRetries) throw err;
                console.warn(`[${this.storeName}] Navigation failed (${err.message}). Retry ${attempt}/${maxRetries} in 3s...`);
                await new Promise(r => setTimeout(r, 3000));
            }
        }
    }

    async scrape(brand, model) {
        throw new Error('scrape() must be implemented by subclass');
    }

    static normalizeUrl(url, domain) {
        if (!url) return '';
        url = url.trim();
        if (url.startsWith('http')) return url;
        if (url.startsWith('//')) return 'https:' + url;
        if (url.startsWith('/')) {
            if (url.includes(domain.replace('https://', '').replace('http://', ''))) return 'https:' + url;
            return domain + url;
        }
        return domain + '/' + url;
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
        }
    }
}

module.exports = DOMNavigator;
