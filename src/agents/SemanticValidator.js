const BRAND_MODEL_SIGNATURES = {
    'PUMA': ['MB.01', 'MB.02', 'MB.03', 'MB.04', 'MB.05', 'MB.06', 'CLYDE', 'RS-X', 'SUEDE'],
    'NIKE': ['DUNK', 'AIR MAX', 'AIR FORCE', 'JORDAN', 'BLAZER', 'CORTEZ', 'WAFFLE'],
    'ADIDAS': ['YEEZY', 'ULTRABOOST', 'NMD', 'STAN SMITH', 'SAMBA', 'GAZELLE', 'FORUM'],
    'NEW BALANCE': ['990', '992', '993', '550', '574', '327', '2002'],
    'ASICS': ['GEL-LYTE', 'GEL-KAYANO', 'GEL-NIMBUS', 'GT-2000'],
};

const NON_SHOE_BLACKLIST = [
    'SANDAL', 'SLIDE', 'SLIDES', 'FLIP FLOP', 'FLIP-FLOP', 'CROCS',
    'BACKPACK', 'BAG', 'TEE', 'SHIRT', 'T-SHIRT', 'HOODIE', 'JACKET',
    'SHORTS', 'PANTS', 'HAT', 'CAP', 'SOCKS', 'SOCK',
    'סנדל', 'סנדלים', 'כפכף', 'כפכפים',
    'תיק', 'חולצה', 'טי שירט', 'מכנס', 'כובע', 'גרב', 'גרביים'
];

class SemanticValidator {
    constructor() { }

    async validate(rawItem, brand, model, targetSize) {
        if (!rawItem || !rawItem.raw_title) return false;

        console.log(`[Agent 3 - Semantic] Validation started for: ${rawItem.raw_title}`);

        await new Promise(resolve => setTimeout(resolve, 50));

        const titleUpper = rawItem.raw_title.toUpperCase();
        const contextUpper = (rawItem.full_context || '').toUpperCase();
        const combinedText = titleUpper + ' ' + contextUpper;
        const brandUpper = brand.toUpperCase();
        const modelUpper = (model || '').toUpperCase();

        // === STEP 1: Anti-Noise Blacklist — reject non-shoe products immediately ===
        for (const keyword of NON_SHOE_BLACKLIST) {
            if (titleUpper.includes(keyword.toUpperCase())) {
                console.log(`[Agent 3 - Semantic] REJECTED (Non-Shoe: "${keyword}"): ${rawItem.raw_title}`);
                return false;
            }
        }

        // === STEP 2: Strict Version Matching ===
        const targetVersionMatch = modelUpper.match(/([A-Z]+)[.\s-]*(\d+(?:\.\d+)?)/);
        if (targetVersionMatch) {
            const prefix = targetVersionMatch[1];
            const targetVersionString = targetVersionMatch[2];
            const targetVersion = parseFloat(targetVersionString);

            const regex = new RegExp(prefix + '[.\\s-]*(\\d+(?:\\.\\d+)?)', 'g');
            let match;
            let foundAnyVersion = false;
            let exactVersionMatch = false;

            while ((match = regex.exec(titleUpper)) !== null) {
                foundAnyVersion = true;
                if (parseFloat(match[1]) === targetVersion) exactVersionMatch = true;
            }

            if (!exactVersionMatch && !foundAnyVersion) {
                regex.lastIndex = 0;
                while ((match = regex.exec(contextUpper)) !== null) {
                    foundAnyVersion = true;
                    if (parseFloat(match[1]) === targetVersion) exactVersionMatch = true;
                }
            }

            if (foundAnyVersion && !exactVersionMatch) {
                console.log(`[Agent 3 - Semantic] REJECTED (Strict Version Mismatch: Expected ${prefix} ${targetVersionString}): ${rawItem.raw_title}`);
                return false;
            }
        }

        // === STEP 3: Junk/Accessory Filter ===
        const junkKeywords = ['LACES', 'BOX ONLY', 'CLEAN KIT', 'CLEANING KIT', 'INSOLE', 'KEEPER'];
        if (junkKeywords.some(k => titleUpper.includes(k))) {
            const shoeKeywords = ['SHOE', 'SNEAKER', 'BOOT', 'TRAINER', 'נעל', 'סניקר', 'כדורסל'];
            if (!shoeKeywords.some(k => titleUpper.includes(k))) {
                console.log(`[Agent 3 - Semantic] REJECTED (Accessory/Junk): ${rawItem.raw_title}`);
                return false;
            }
        }

        // === STEP 4: Brand + Model Match (title OR full_context) ===
        const brandFound = combinedText.includes(brandUpper);

        const modelFirstWord = modelUpper.split(' ')[0];
        const modelInTitle = modelFirstWord.length > 2 && titleUpper.includes(modelFirstWord);
        const modelInContext = modelFirstWord.length > 2 && contextUpper.includes(modelFirstWord);

        const signatures = BRAND_MODEL_SIGNATURES[brandUpper] || [];
        const signatureFound = signatures.some(sig => combinedText.includes(sig.toUpperCase()));

        if (!brandFound && !modelInTitle && !modelInContext && !signatureFound) {
            console.log(`[Agent 3 - Semantic] REJECTED (Wrong Brand): ${rawItem.raw_title}`);
            return false;
        }

        if (modelInContext && !modelInTitle) {
            console.log(`[Agent 3 - Semantic] PASSED (Model found in full_context fallback): ${rawItem.raw_title}`);
            return true;
        }

        console.log(`[Agent 3 - Semantic] PASSED: ${rawItem.raw_title}`);
        return true;
    }
}

module.exports = new SemanticValidator();
