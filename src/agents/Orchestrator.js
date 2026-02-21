const EventEmitter = require('events');
const SemanticValidator = require('./SemanticValidator');
const VisualVerifier = require('./VisualVerifier');
const DataNormalizer = require('./DataNormalizer');
const QASentinel = require('./QASentinel');
const UXPolisher = require('./UXPolisher');

class Orchestrator extends EventEmitter {
    constructor() {
        super();
        this.timeoutLimit = 120000; // 120 seconds — covers headless boot + scraping (pipeline runs after)
        this.workers = []; // Array of instantiated DOMNavigators
        this.results = [];
    }

    /**
     * Register a new scraper (DOMNavigator child class)
     * @param {Object} workerInstance Instance of a class extending DOMNavigator
     */
    registerWorker(workerInstance) {
        this.workers.push(workerInstance);
    }

    /**
     * Main entry point to start the search process
     * @param {String} brand e.g., "Nike"
     * @param {String} model e.g., "Dunk Low"
     * @param {String} size e.g., "42" or "*"
     */
    async startSearch(brand, model, size) {
        if (this.workers.length === 0) {
            console.warn('[Orchestrator] No workers registered. Exiting.');
            return;
        }

        console.log(`\n[Orchestrator] Starting search across ${this.workers.length} worker groups...`);
        console.log(`[Orchestrator] Target: ${brand} ${model} (Size: ${size})\n`);

        // Emit an event to UI that search has started
        this.emit('search_started', { brand, model, size, totalWorkers: this.workers.length });

        // Execute workers in batches of 3 to avoid runner crashes / net::ERR_NETWORK_CHANGED
        const batchSize = 3;
        for (let i = 0; i < this.workers.length; i += batchSize) {
            const batch = this.workers.slice(i, i + batchSize);
            console.log(`\n[Orchestrator] Running batch ${Math.floor(i / batchSize) + 1} (${batch.map(w => w.storeName).join(', ')})`);

            const promises = batch.map(worker => this.executeWorker(worker, brand, model, size));
            await Promise.allSettled(promises);

            // Short cooldown between batches to let the network stack breathe
            if (i + batchSize < this.workers.length) {
                console.log(`[Orchestrator] Batch complete. Cooling down for 3 seconds before next batch...`);
                await new Promise(r => setTimeout(r, 3000));
            }
        }

        console.log(`\n[Orchestrator] Search complete. Processed all worker groups.`);
        this.emit('search_completed', { totalResults: this.results.length });
    }

    /**
     * Executes a single worker with a timeout wrapper and passes data through the agents
     */
    async executeWorker(worker, brand, model, size) {
        return new Promise(async (resolve) => {
            let timeoutId;
            let scrapeCompleted = false;
            try {
                // 1. Timeout Handler — only cancels if scrape hasn't finished yet
                timeoutId = setTimeout(() => {
                    if (!scrapeCompleted) {
                        console.error(`[Orchestrator] Timeout (${this.timeoutLimit / 1000}s) reached for ${worker.storeName} during SCRAPE. Skipping.`);
                        worker.close().catch(() => { });
                        resolve({ status: 'timeout', store: worker.storeName });
                    }
                }, this.timeoutLimit);

                // 2. Initialize Browser
                await worker.init();

                // Normalize model: remove duplicate words (e.g., "ON Cloud Cloud X" → "ON Cloud X")
                const modelWords = model.trim().split(/\s+/);
                const dedupWords = [];
                for (const word of modelWords) {
                    if (!dedupWords.some(w => w.toLowerCase() === word.toLowerCase())) dedupWords.push(word);
                }
                const cleanModel = dedupWords.join(' ');

                // 3. AGENT 2: DOM Navigator Execution
                console.log(`[Orchestrator] Executing Agent 2 (DOM Navigator) for ${worker.storeName}...`);
                const rawItems = await worker.scrape(brand, cleanModel);
                console.log(`[Orchestrator] ${worker.storeName} scraped ${rawItems.length} raw items.`);

                // Scrape done — cancel timeout so pipeline can run to completion
                scrapeCompleted = true;
                clearTimeout(timeoutId);

                // Cleanup browser immediately after scraping
                await worker.close();

                // --- PIPELINE PASSTHROUGH (Agents 3-7) ---
                // Runs without a timeout — the scrape was the slow part.
                for (const rawItem of rawItems) {
                    await this.processItemThroughPipeline(rawItem, brand, model, size, worker.storeName);
                }

                resolve({ status: 'success', store: worker.storeName, itemsCount: rawItems.length });

            } catch (error) {
                clearTimeout(timeoutId);
                console.error(`[Orchestrator] Error in worker ${worker.storeName}:`, error.message);
                if (worker) {
                    await worker.close().catch(() => { });
                }
                // Resolve (not reject) so Promise.allSettled lets other workers continue
                resolve({ status: 'error', store: worker.storeName, message: error.message });
            }
        });
    }

    /**
     * Processes a single raw item through Agents 3 to 7
     */
    async processItemThroughPipeline(rawItem, brand, model, size, storeName) {
        try {
            // AGENT 3: Semantic Validator
            const isSemanticallyValid = await SemanticValidator.validate(rawItem, brand, model, size);
            if (!isSemanticallyValid) return;

            // AGENT 4: Visual Verifier
            const isVisuallyValid = await VisualVerifier.verify(rawItem.raw_image_url, model);
            if (!isVisuallyValid) return;

            // AGENT 5: Data Normalizer
            const normalizedItem = DataNormalizer.normalize(rawItem, storeName);
            if (!normalizedItem) return;

            // AGENT 6: QA Sentinel
            const isSane = await QASentinel.check(normalizedItem, size);
            if (!isSane) return;

            // AGENT 7: UX Polisher
            const finalItem = UXPolisher.format(normalizedItem);
            if (!finalItem) return;

            // Push validated item
            this.results.push(finalItem);

            // Stream the single successful result immediately to the UI/caller
            this.emit('item_found', finalItem);

        } catch (error) {
            console.error(`[Orchestrator Pipeline Error - ${storeName}]`, error.message);
        }
    }
}

module.exports = Orchestrator;
