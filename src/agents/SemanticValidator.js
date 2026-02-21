const NON_SHOE_BLACKLIST = [
    'SANDAL', 'SLIDE', 'SLIDES', 'FLIP FLOP', 'FLIP-FLOP', 'CROCS',
    'BACKPACK', 'BAG', 'TEE', 'SHIRT', 'T-SHIRT', 'HOODIE', 'JACKET',
    'SHORTS', 'PANTS', 'HAT', 'CAP', 'SOCKS', 'SOCK',
    'סנדל', 'סנדלים', 'כפכף', 'כפכפים',
    'תיק', 'חולצה', 'טי שירט', 'מכנס', 'כובע', 'גרב', 'גרביים'
];

const JUNK_KEYWORDS = ['LACES', 'BOX ONLY', 'CLEAN KIT', 'CLEANING KIT', 'INSOLE', 'KEEPER'];
const SHOE_KEYWORDS = ['SHOE', 'SNEAKER', 'BOOT', 'TRAINER', 'נעל', 'סניקר', 'כדורסל'];

// Known model aliases that should be treated as the same model
const MODEL_ALIASES = {
    '530': ['530'],
    '550': ['550'],
    '574': ['574'],
    '990': ['990', 'M990'],
    '992': ['992', 'M992'],
    '993': ['993', 'M993'],
    '327': ['327'],
    '2002': ['2002', '2002R'],
    '9060': ['9060'],
    'MB.01': ['MB.01', 'MB01'],
    'MB.02': ['MB.02', 'MB02'],
    'MB.03': ['MB.03', 'MB03'],
    'MB.04': ['MB.04', 'MB04'],
    'MB.05': ['MB.05', 'MB05'],
    'MB.06': ['MB.06', 'MB06'],
};

class SemanticValidator {
    constructor() { }

    async validate(rawItem, brand, model, targetSize) {
        if (!rawItem || !rawItem.raw_title) return false;

        const title = rawItem.raw_title;
        const titleUpper = title.toUpperCase();
        const contextUpper = (rawItem.full_context || '').toUpperCase();
        const combinedText = titleUpper + ' ' + contextUpper;
        const brandUpper = (brand || '').toUpperCase().trim();
        const modelUpper = (model || '').toUpperCase().trim();

        console.log(`[Agent 3 - Semantic] Checking: "${title}"`);

        // === RULE 1: Non-Shoe Blacklist ===
        for (const keyword of NON_SHOE_BLACKLIST) {
            if (titleUpper.includes(keyword.toUpperCase())) {
                console.log(`[Agent 3 - Semantic] REJECTED (Non-Shoe "${keyword}"): ${title}`);
                return false;
            }
        }

        // === RULE 2: Junk/Accessory Filter ===
        if (JUNK_KEYWORDS.some(k => titleUpper.includes(k))) {
            if (!SHOE_KEYWORDS.some(k => titleUpper.includes(k))) {
                console.log(`[Agent 3 - Semantic] REJECTED (Accessory/Junk): ${title}`);
                return false;
            }
        }

        // === RULE 3: Exclusive Model Match ===
        // If a model is specified, it MUST appear literally in the title or context.
        // A brand-only match is NOT enough. No second chances.
        if (modelUpper) {
            const variants = MODEL_ALIASES[modelUpper] || [modelUpper];

            const modelFoundInTitle = variants.some(v => titleUpper.includes(v));
            const modelFoundInContext = variants.some(v => contextUpper.includes(v));

            if (!modelFoundInTitle && !modelFoundInContext) {
                // Scan for any OTHER model numbers in the title to give a useful rejection reason
                // Match known model patterns: 3-4 digit numbers, alphanumeric codes
                const otherModelPattern = /\b(\d{3,4}[A-Z]?\d*|[A-Z]{1,3}\.?\d{2,4}(?:\.\d+)?|[A-Z]+CELL|FUELCELL|FRESHFOAM)\b/g;
                const foundInTitle = [...titleUpper.matchAll(otherModelPattern)].map(m => m[1]);

                if (foundInTitle.length > 0) {
                    console.log(`[Agent 3 - Semantic] REJECTED (Model Mismatch: Found "${foundInTitle[0]}", Expected "${modelUpper}"): ${title}`);
                } else {
                    console.log(`[Agent 3 - Semantic] REJECTED (Model "${modelUpper}" not in title or context): ${title}`);
                }
                return false;
            }

            if (modelFoundInContext && !modelFoundInTitle) {
                console.log(`[Agent 3 - Semantic] PASSED (model "${modelUpper}" found in context): ${title}`);
                return true;
            }
        } else {
            // No model specified — require at least the brand
            if (brandUpper && !combinedText.includes(brandUpper)) {
                console.log(`[Agent 3 - Semantic] REJECTED (Brand "${brand}" not found): ${title}`);
                return false;
            }
        }

        console.log(`[Agent 3 - Semantic] PASSED: ${title}`);
        return true;
    }
}

module.exports = new SemanticValidator();
