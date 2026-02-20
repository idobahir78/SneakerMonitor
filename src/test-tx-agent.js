const Orchestrator = require('./agents/Orchestrator');
const TerminalXAgent = require('./agents/TerminalXAgent');

async function runTest() {
    console.log('--- Starting Terminal X Agent Interception Test ---');

    // We only register Terminal X for this isolated test
    const orchestrator = new Orchestrator();
    orchestrator.registerWorker(new TerminalXAgent());

    // Listen to real-time verified streams
    orchestrator.on('item_found', (item) => {
        console.log('\n✅ [Orchestrator Pipeline] Verified Item:');
        console.log(JSON.stringify(item, null, 2));
    });

    orchestrator.on('search_completed', (stats) => {
        console.log(`\n--- Test Complete. Total Passed UI Items: ${stats.totalResults} ---`);
        process.exit(0);
    });

    // Run a real search query against Terminal X
    await orchestrator.startSearch('Nike', 'Dunk', '*');
}

runTest();
