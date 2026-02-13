const colors = require('colors');
const Factory54Scraper = require('./scrapers/factory54');
const TerminalXScraper = require('./scrapers/terminalx');
const FootLockerScraper = require('./scrapers/footlocker');

async function runDebug() {
    console.log(`\n🔍 Starting DEBUG scrape...`.cyan.bold);

    // Check specific scrapers (StockX excluded as we know it fails)
    const scrapers = [
        new Factory54Scraper(),
        new TerminalXScraper(),
        new FootLockerScraper()
    ];

    for (const scraper of scrapers) {
        console.log(`\nTesting ${scraper.storeName}...`.yellow);
        try {
            const results = await scraper.scrape();
            if (results.length > 0) {
                console.log(`✅ Success! Found ${results.length} items.`.green);
                console.log(`   First item:`.white);
                console.log(`   - Title: ${results[0].title}`);
                console.log(`   - Price: ${results[0].price}`);
                console.log(`   - Link:  ${results[0].link}`);
            } else {
                console.log(`❌ Failed. Found 0 items. Selectors might be wrong.`.red);
            }
        } catch (error) {
            console.log(`❌ Error: ${error.message}`.red);
        }
    }
    console.log(`\nDebug finished.`.magenta);
}

runDebug();
