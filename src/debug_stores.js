const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const Factory54Scraper = require('./scrapers/factory54');
const TerminalXScraper = require('./scrapers/terminalx');
const FootLockerScraper = require('./scrapers/footlocker');
const MegaSportScraper = require('./scrapers/megasport');
const ShoesOnlineScraper = require('./scrapers/shoesonline');
const MasterSportScraper = require('./scrapers/mastersport');
const AlufSportScraper = require('./scrapers/alufsport');
const LimeShoesScraper = require('./scrapers/limeshoes');
const MayersScraper = require('./scrapers/mayers');
const Arba4Scraper = require('./scrapers/arba4');

const TARGETS = [
    { name: 'Terminal X', scraper: TerminalXScraper, url: 'https://www.terminalx.com/w826250001?color=4' },
    { name: 'Foot Locker', scraper: FootLockerScraper, url: 'https://footlocker.co.il/products/mr530ewb?_pos=1&_sid=e4a3419fb&_ss=r&variant=44929046872217' },
    { name: 'Factory 54', scraper: Factory54Scraper, url: 'https://www.factory54.co.il/search?q=530&search-button=&lang=iw_IL' }, // Search page
    { name: 'Mega Sport', scraper: MegaSportScraper, url: 'https://www.megasport.co.il/products/nbw8801s6?_pos=1&_sid=4ba066c6e&_ss=r' },
    { name: 'ShoesOnline', scraper: ShoesOnlineScraper, url: 'https://shoesonline.co.il/product/men-new-balance-gr530-2/?attribute_pa_color=white-gray' },
    { name: 'Master Sport', scraper: MasterSportScraper, url: 'https://mastersport.co.il/product/%d7%a0%d7%a2%d7%9c%d7%99-%d7%a0%d7%99%d7%95-%d7%91%d7%90%d7%9c%d7%90%d7%a0%d7%a1-%d7%90%d7%95%d7%a4%d7%a0%d7%94-%d7%9c%d7%a0%d7%a9%d7%99%d7%9d-new-balance-mr530ck/' },
    { name: 'Aluf Sport', scraper: AlufSportScraper, url: 'https://www.alufsport.co.il/items/7573156-%D7%A0%D7%A2%D7%9C%D7%99-%D7%A0%D7%99%d7%95-%D7%91%D7%90%d7%9c%d7%90%d7%a0%d7%a1-NEW-BALANCE-M460LK4-%D7%92%D7%91%D7%a8%D7%99%D7%9d' },
    { name: 'Lime Shoes', scraper: LimeShoesScraper, url: 'https://limeshoes.co.il/product/new-balance-m990v6-white/' },
    { name: 'Mayers', scraper: MayersScraper, url: 'https://www.mayers.co.il/p/new-balance-530-%d7%a0%d7%a2%d7%9c%d7%99-%d7%a0%d7%99%d7%95-%d7%91%d7%90%d7%9c%d7%90%d7%a0%d7%a1-7/' },
    { name: 'Arba4', scraper: Arba4Scraper, url: 'https://arba4.co.il/product/%d7%a0%d7%a2%d7%9c%d7%99-%d7%a0%d7%99%d7%95-%d7%91%d7%9c%d7%90%d7%a0%d7%a1-530/' }
];

(async () => {
    const browser = await puppeteer.launch({ headless: "new" });
    console.log('🚀 Starting Targeted URL Verification...');

    for (const target of TARGETS) {
        console.log(`\n🔍 Checking ${target.name}...`);
        try {
            const page = await browser.newPage();
            // Mock navigation to specific URL for testing (overriding scraper's default search nav)
            await page.setViewport({ width: 1366, height: 768 });

            // Allow override of navigate method effectively
            const scraper = new target.scraper('530');
            scraper.url = target.url; // Hack: override URL 

            console.log(`   Navigating to: ${target.url}`);
            await scraper.navigate(page);

            // For product pages (deep links), we need to see if we can parse sizes/price
            // For search pages (Factory 54), we check the list parser

            let items = [];
            if (target.url.includes('/product/') || target.url.includes('/items/') || target.url.includes('?variant=') || target.url.includes('/w')) {
                // It's a product page. We probably need a parseProductPage method or similar, 
                // BUT our scrapers logic usually parses a LIST. 
                // Most of our scrapers don't support single product page parsing directly in `parse`.
                // They expect a search result page.
                // So for these tests, we'll see if the "Deep Scrape" logic works or if we need to adjust logic.

                console.log('   (Direct Product Link - skipping list parse test for now, checking DOM)');
                const title = await page.title();
                console.log(`   Page Title: ${title}`);

                // Screenshot for visual check
                await page.screenshot({ path: `debug_${target.name.replace(/\s/g, '_')}.png` });

            } else {
                // Search result page (Factory 54)
                items = await scraper.parse(page);
                console.log(`   ✅ Parsed ${items.length} items.`);
                if (items.length > 0) {
                    console.log(`   Sample: ${items[0].title} - ${items[0].price}`);
                } else {
                    console.log(`   ❌ No items parsed! Check selectors.`);
                }
            }

            await page.close();
        } catch (e) {
            console.error(`   ❌ Failed: ${e.message}`);
        }
    }

    await browser.close();
})();
