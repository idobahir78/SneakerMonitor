const Orchestrator = require('./agents/Orchestrator');
const DOMNavigator = require('./agents/DOMNavigator');

// 1. Create a Mock Store that simulates DOMNavigator extracting raw data
class MockStoreNavigator extends DOMNavigator {
    constructor() {
        super('MockStore', 'https://mockstore.com');
    }

    async init() {
        // Override init to bypass Puppeteer for this fast test
        console.log(`[${this.storeName}] Mock Init Successful.`);
    }

    async scrape(brand, model) {
        // Simulate scraping delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        return [
            // Should PASS
            {
                raw_title: 'Nike Dunk Low Retro White Black',
                raw_price: '₪ 450.00',
                raw_image_url: 'https://images.nike.com/is/image/DotCom/DD1391_100',
                product_url: 'https://mockstore.com/nike-dunk-low-retro'
            },
            // Should FAIL Agent 3 (Semantic - Accessory)
            {
                raw_title: 'Premium Shoelaces for Nike Dunk',
                raw_price: '50 NIS',
                raw_image_url: 'https://images.nike.com/laces',
                product_url: 'https://mockstore.com/laces'
            },
            // Should FAIL Agent 5/6 (Invalid URL / Normalization)
            {
                raw_title: 'Nike Dunk High',
                raw_price: '600',
                raw_image_url: 'https://images.nike.com/dunk-high',
                product_url: '/relative/path/dunk-high' // Missing HTTP
            },
            // Should FAIL Agent 6 (Price sanity)
            {
                raw_title: 'Nike Dunk Low Exclusive',
                raw_price: '₪ 99999', // Too expensive
                raw_image_url: 'https://images.nike.com/exclusive',
                product_url: 'https://mockstore.com/exclusive'
            }
        ];
    }
}

// 2. Setup Orchestrator and Run
async function runTest() {
    const orchestrator = new Orchestrator();

    // Register our mock worker
    orchestrator.registerWorker(new MockStoreNavigator());

    // Listen to real-time streams
    orchestrator.on('item_found', (item) => {
        console.log('\n--- UI STREAM OUPUT ---');
        console.log(JSON.stringify(item, null, 2));
        console.log('-----------------------\n');
    });

    console.log('Starting end-to-end pipeline test...');
    await orchestrator.startSearch('Nike', 'Dunk Low', '*');
}

runTest();
