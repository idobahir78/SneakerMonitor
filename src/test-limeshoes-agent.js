const LimeShoesAgent = require('./agents/LimeShoesAgent');
const SemanticValidator = require('./agents/SemanticValidator');
const VisualVerifier = require('./agents/VisualVerifier');
const DataNormalizer = require('./agents/DataNormalizer');
const QASentinel = require('./agents/QASentinel');
const UXPolisher = require('./agents/UXPolisher');

async function run() {
    console.log("--- Starting Lime Shoes Agent Interception Test ---\n");
    const target = { Brand: "New", Model: "Balance" };

    try {
        const agent = new LimeShoesAgent();
        await agent.init();

        console.log(`[Orchestrator] Executing Agent 2 (DOM Navigator) for Lime Shoes...`);
        let items = await agent.scrape(target.Brand, target.Model);
        await agent.close();

        if (items.length === 0) {
            console.log("\n[!] No items returned from Lime Shoes. Exiting.");
            return;
        }

        let passedItems = [];
        for (const rawItem of items) {
            console.log("Raw item:", rawItem);
            // Semantic
            const semValid = await SemanticValidator.validate(rawItem.raw_title, target);
            if (!semValid) {
                console.log(`[Validation Failed] Semantic: ${rawItem.raw_title}`);
                continue;
            }

            // Visual Validator bypass for tests
            // const visValid = await VisualVerifier.validate(rawItem.raw_image_url, target);

            // Normalizer
            const normItem = DataNormalizer.normalize(rawItem);

            // Sentinel
            const isSane = await QASentinel.check(normItem);
            if (!isSane) {
                console.log(`[Validation Failed] Sentinel checks failed for: ${normItem.title}`);
                continue;
            }

            const finalItem = UXPolisher.format(normItem);
            passedItems.push(finalItem);
        }

        console.log(`\n--- Test Complete. Total Passed UI Items: ${passedItems.length} ---`);
        if (passedItems.length > 0) {
            console.log("Sample Item:", passedItems[0]);
        }
    } catch (e) {
        console.error(e);
    }
}

run();
