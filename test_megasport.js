const MegaSportScraper = require('./src/scrapers/mega-sport');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function test() {
    console.log('Testing Mega Sport Scraper (Interaction Mode)...');

    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        // Change default to 'Wade' to match user case, but kept ability to change
        const scraper = new MegaSportScraper('Wade');

        console.log('Scraping...');
        // Mocking behavior of main script (no deep scrape for this test unless implemented)
        const results = await scraper.scrape(browser, [], []);

        console.log(`Found ${results.length} results.`);
        if (results.length > 0) {
            console.log('First 3 items:', JSON.stringify(results.slice(0, 3), null, 2));
        } else {
            console.log('Zero results found.');
            // Maybe take a screenshot if zero
            const page = (await browser.pages())[0]; // Might need to grab the page if scraper closes it? 
            // Scraper usually closes the page. 
        }

    } catch (e) {
        console.error('Test failed:', e);
    } finally {
        // Keep browser open for a bit if we want to see what happened
        await new Promise(r => setTimeout(r, 5000));
        await browser.close();
    }
}

test();
