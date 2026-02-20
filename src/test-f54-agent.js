const Orchestrator = require('./agents/Orchestrator');
const Factory54Agent = require('./agents/Factory54Agent');

async function testF54() {
    console.log("--- Starting Factory 54 Agent Interception Test ---");

    // Create an override to ONLY run Factory 54
    class TestOrchestrator extends Orchestrator {
        constructor() {
            super();
            // Override workers manually to test just Factory 54
            this.registerWorker(new Factory54Agent());
        }
    }

    const o = new TestOrchestrator();

    // Stream the UI output to console
    o.on('ui_update', (item) => {
        console.log(`\n✅ [Orchestrator Pipeline] Verified Item:`);
        console.log(JSON.stringify(item, null, 2));
    });

    const activeNavigators = await o.startSearch('Nike', 'Dunk', '*');

    console.log(`\n--- Test Complete. Total Passed UI Items: ${o.results.length} ---`);
    process.exit(0);
}

testF54().catch(console.error);
