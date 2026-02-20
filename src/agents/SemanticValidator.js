// TODO: In production, import Google GenAI SDK
// const { GoogleGenerativeAI } = require("@google/genai");
// const genAI = new GoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });

class SemanticValidator {
    constructor() {
        // Initialize the fast model (Flash is cheap and fast for text analysis)
        // this.model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    }

    /**
     * Agent 3 Logic: Filters raw titles and descriptions using an LLM to understand context.
     * Prevents subtle false positives like "Shoelaces for Dunk" or "Jordan 1 Box without shoes".
     */
    async validate(rawItem, brand, model, targetSize) {
        if (!rawItem || !rawItem.raw_title) return false;

        console.log(`[Agent 3 - Semantic] Validation started for: ${rawItem.raw_title}`);

        const prompt = `
        You are an AI assistant filtering e-commerce sneaker listings.
        
        Target Brand: ${brand}
        Target Model: ${model}
        Item Title: ${rawItem.raw_title}
        Item Description: ${rawItem.raw_description || 'N/A'}
        Target Size: ${targetSize === '*' ? 'Any' : targetSize}
        
        Rules:
        1. IF the item is NOT footwear (e.g., Socks, Shoelaces, Cleaning Kit, Shirt, Hat, Box only) -> return "FALSE"
        2. IF the item does NOT match the Target Brand or Target Model contextually -> return "FALSE"
        3. IF Target Size is not 'Any' AND the item explicitly states that size is out of stock -> return "FALSE"
        
        Return exactly and only the string "TRUE" if the item passes, or "FALSE" if it fails.
        `;

        try {
            // MOCK IMPLEMENTATION FOR DEMO
            // In reality: 
            // const result = await this.model.generateContent(prompt);
            // const answer = result.response.text().trim().toUpperCase();

            await new Promise(resolve => setTimeout(resolve, 200));

            // Hardcoded basic sanity check to mimic LLM behavior rejecting obvious junk
            const titleUpper = rawItem.raw_title.toUpperCase();
            if (titleUpper.includes('LACES') || titleUpper.includes('SOCKS') || titleUpper.includes('BOX') || titleUpper.includes('CLEAN KIT')) {
                console.log(`[Agent 3 - Semantic] REJECTED (Accessory/Junk): ${rawItem.raw_title}`);
                return false;
            }

            // Brand check: accept if brand OR model name appears in the title.
            // Hebrew sites (e.g. TerminalX) never include the brand name in product titles —
            // only the model code (e.g. "MB.05"). We trust the scraper's brand-filtered search.
            const brandFound = titleUpper.includes(brand.toUpperCase());
            const modelFound = model && titleUpper.includes(model.toUpperCase().split(' ')[0]);
            const storeNameFound = rawItem.store_name || rawItem.raw_store; // already brand-filtered

            if (!brandFound && !modelFound && !storeNameFound) {
                console.log(`[Agent 3 - Semantic] REJECTED (Wrong Brand): ${rawItem.raw_title}`);
                return false;
            }

            // console.log(`[Agent 3 - Semantic] PASSED: ${rawItem.raw_title}`);
            return true;

        } catch (error) {
            console.error('[Agent 3 - Semantic] LLM Error:', error.message);
            return false; // Fail safe
        }
    }
}

module.exports = new SemanticValidator();
